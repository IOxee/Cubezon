-- Cubezon: initial schema.
-- The Minecraft plugin is the only authority over money and items: it connects as the
-- database owner (bypasses RLS). The web reads the public catalog with the publishable key
-- and performs every write from the server with the secret key.

-- Types

create type public.shop_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
create type public.listing_status as enum ('ACTIVE', 'PAUSED', 'REMOVED');
create type public.escrow_status as enum ('AVAILABLE', 'RESERVED', 'DELIVERED', 'RETURNED');
create type public.order_status as enum ('PENDING', 'PAID', 'READY', 'COLLECTED', 'FAILED', 'REFUNDED');

-- Helpers

create function public.set_updated_at() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Players and account linking

-- Minecraft accounts known to the system (created by the plugin).
create table public.players (
    uuid         uuid primary key,
    name         text        not null,
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

-- Single-use codes issued with /cubezon link and redeemed on the web.
create table public.link_codes (
    code        text primary key check (code ~ '^[2-9A-HJKMNP-Z]{6}$'),
    player_uuid uuid        not null references public.players (uuid) on delete cascade,
    expires_at  timestamptz not null,
    redeemed_at timestamptz,
    created_at  timestamptz not null default now()
);

create index link_codes_player_idx on public.link_codes (player_uuid);

-- Web sessions created when a link code is redeemed. Only the token hash is stored.
create table public.web_sessions (
    id           uuid primary key default gen_random_uuid(),
    token_hash   text        not null unique,
    player_uuid  uuid        not null references public.players (uuid) on delete cascade,
    expires_at   timestamptz not null,
    created_at   timestamptz not null default now(),
    last_used_at timestamptz
);

create index web_sessions_player_idx on public.web_sessions (player_uuid);

-- Shops and listings

create table public.shops (
    id          uuid primary key default gen_random_uuid(),
    owner_uuid  uuid               not null references public.players (uuid),
    name        text               not null check (char_length(name) between 3 and 40),
    slug        text               not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    description text               not null default '' check (char_length(description) <= 500),
    status      public.shop_status not null default 'PENDING',
    reviewed_by uuid               references public.players (uuid),
    reviewed_at timestamptz,
    created_at  timestamptz        not null default now(),
    updated_at  timestamptz        not null default now()
);

create index shops_owner_idx on public.shops (owner_uuid);

create trigger shops_set_updated_at
    before update on public.shops
    for each row execute function public.set_updated_at();

-- What a shop sells. One unit = one deposited ItemStack (see escrow_items).
create table public.listings (
    id          uuid primary key default gen_random_uuid(),
    shop_id     uuid                  not null references public.shops (id),
    title       text                  not null check (char_length(title) between 3 and 60),
    description text                  not null default '' check (char_length(description) <= 500),
    material    text                  not null check (material ~ '^[a-z0-9_]+$'), -- e.g. diamond_sword, for the web icon
    unit_amount integer               not null check (unit_amount between 1 and 99), -- items per unit
    unit_price  numeric(14, 2)        not null check (unit_price > 0),
    status      public.listing_status not null default 'ACTIVE',
    created_at  timestamptz           not null default now(),
    updated_at  timestamptz           not null default now()
);

create index listings_shop_idx on public.listings (shop_id);

create trigger listings_set_updated_at
    before update on public.listings
    for each row execute function public.set_updated_at();

-- Lockers (pickup points registered in-game by an admin)

create table public.lockers (
    id         uuid primary key default gen_random_uuid(),
    name       text        not null unique check (char_length(name) between 3 and 40),
    world      text        not null,
    x          integer     not null,
    y          integer     not null,
    z          integer     not null,
    active     boolean     not null default true,
    created_at timestamptz not null default now(),
    unique (world, x, y, z)
);

-- Orders

-- Created by the web as PENDING; every later transition is made by the plugin.
create table public.orders (
    id             uuid primary key default gen_random_uuid(),
    buyer_uuid     uuid                not null references public.players (uuid),
    listing_id     uuid                not null references public.listings (id),
    shop_id        uuid                not null references public.shops (id),
    locker_id      uuid                not null references public.lockers (id),
    quantity       integer             not null check (quantity between 1 and 64), -- units
    unit_price     numeric(14, 2)      not null check (unit_price > 0),            -- price snapshot
    total          numeric(14, 2)      not null check (total = unit_price * quantity),
    status         public.order_status not null default 'PENDING',
    failure_reason text,
    created_at     timestamptz         not null default now(),
    updated_at     timestamptz         not null default now(),
    paid_at        timestamptz,
    ready_at       timestamptz,
    collected_at   timestamptz
);

create index orders_buyer_idx on public.orders (buyer_uuid);
create index orders_shop_idx on public.orders (shop_id);
-- The plugin polls this.
create index orders_pending_idx on public.orders (created_at) where status = 'PENDING';
-- Pickup lookups: what is waiting for this player at this locker.
create index orders_ready_idx on public.orders (buyer_uuid, locker_id) where status = 'READY';

create trigger orders_set_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();

-- Audit log: every status change of an order.
create table public.order_events (
    id          bigint generated always as identity primary key,
    order_id    uuid                not null references public.orders (id) on delete cascade,
    from_status public.order_status,
    to_status   public.order_status not null,
    note        text,
    created_at  timestamptz         not null default now()
);

create index order_events_order_idx on public.order_events (order_id);

create function public.log_order_status() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.order_events (order_id, from_status, to_status)
        values (new.id, null, new.status);
    elsif new.status is distinct from old.status then
        insert into public.order_events (order_id, from_status, to_status, note)
        values (new.id, old.status, new.status, new.failure_reason);
    end if;
    return new;
end;
$$;

create trigger orders_log_status
    after insert or update of status on public.orders
    for each row execute function public.log_order_status();

-- Escrow: items deposited in-game by sellers

-- One row = one unit of a listing (an ItemStack serialized with ItemStack#serializeAsBytes).
-- Stock of a listing = rows with status AVAILABLE.
create table public.escrow_items (
    id           uuid primary key default gen_random_uuid(),
    listing_id   uuid                 not null references public.listings (id),
    item_data    bytea                not null,
    status       public.escrow_status not null default 'AVAILABLE',
    order_id     uuid                 references public.orders (id),
    deposited_at timestamptz          not null default now(),
    updated_at   timestamptz          not null default now(),
    check ((status = 'AVAILABLE') = (order_id is null) or status = 'RETURNED')
);

create index escrow_items_available_idx on public.escrow_items (listing_id) where status = 'AVAILABLE';
create index escrow_items_order_idx on public.escrow_items (order_id);

create trigger escrow_items_set_updated_at
    before update on public.escrow_items
    for each row execute function public.set_updated_at();

-- Public stock per listing (no item data exposed). Runs as its owner because escrow_items
-- has no public policy, so it filters to the public catalog itself.
create view public.listing_stock
    with (security_invoker = false)
as
select l.id as listing_id, count(e.id)::integer as units_available
from public.listings l
join public.shops s on s.id = l.shop_id and s.status = 'APPROVED'
left join public.escrow_items e on e.listing_id = l.id and e.status = 'AVAILABLE'
where l.status = 'ACTIVE'
group by l.id;

-- Row Level Security
-- RLS on everywhere. Without a policy, anon/authenticated get nothing.
-- Only the public catalog is readable with the publishable key.

alter table public.players enable row level security;
alter table public.link_codes enable row level security;
alter table public.web_sessions enable row level security;
alter table public.shops enable row level security;
alter table public.listings enable row level security;
alter table public.lockers enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.escrow_items enable row level security;

create policy "Approved shops are public"
    on public.shops for select
    to anon, authenticated
    using (status = 'APPROVED');

create policy "Active listings of approved shops are public"
    on public.listings for select
    to anon, authenticated
    using (
        status = 'ACTIVE'
        and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'APPROVED')
    );

create policy "Active lockers are public"
    on public.lockers for select
    to anon, authenticated
    using (active);

-- The stock view runs as its owner, so expose only what the catalog needs.
revoke all on public.listing_stock from anon, authenticated;
grant select on public.listing_stock to anon, authenticated;
