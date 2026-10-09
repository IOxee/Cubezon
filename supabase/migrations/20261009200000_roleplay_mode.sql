-- Cubezon: roleplay order mode.
-- In config.yml the plugin chooses orders.mode (read only at startup):
--   automatic: the plugin processes PENDING orders by itself (as before).
--   roleplay:  each shop handles its orders from a "company computer" block in its zone:
--              accept (buyer charged, money held, PAID = "being prepared") or reject; a physical
--              package is carried to the locker to deliver it (READY, seller paid then).
-- New failure_reason codes: SHOP_REJECTED and EXPIRED (FAILED, nothing charged) and
-- DELIVERY_EXPIRED (REFUNDED: accepted but never delivered, buyer refunded).

-- Settings the plugin publishes for the web (e.g. the order mode)

create table public.plugin_settings (
    key        text primary key,
    value      text        not null,
    updated_at timestamptz not null default now()
);

alter table public.plugin_settings enable row level security;

create policy "Plugin settings are public"
    on public.plugin_settings for select
    to anon, authenticated
    using (true);

-- Shop employees (besides the owner) who can use the company computer

create table public.shop_members (
    shop_id     uuid        not null references public.shops (id) on delete cascade,
    player_uuid uuid        not null references public.players (uuid) on delete cascade,
    added_by    uuid        not null references public.players (uuid),
    created_at  timestamptz not null default now(),
    primary key (shop_id, player_uuid)
);

create index shop_members_player_idx on public.shop_members (player_uuid);

alter table public.shop_members enable row level security;

-- Company computers placed inside shop zones

create table public.shop_computers (
    id         uuid primary key default gen_random_uuid(),
    shop_id    uuid        not null references public.shops (id) on delete cascade,
    world      text        not null,
    x          integer     not null,
    y          integer     not null,
    z          integer     not null,
    placed_by  uuid        not null references public.players (uuid),
    created_at timestamptz not null default now(),
    unique (world, x, y, z)
);

create index shop_computers_shop_idx on public.shop_computers (shop_id);

alter table public.shop_computers enable row level security;

-- Seller payout tracking
-- automatic: the seller is paid together with the charge (PAID).
-- roleplay:  the money is held from PAID and the seller is paid on delivery (READY).
-- The plugin sets seller_paid_at *before* paying (a crash can underpay, never pay twice) and
-- clears it again if the payment fails, so it is retried.

alter table public.orders
    add column seller_paid_at timestamptz;

-- Orders already paid before this migration were paid to the seller at the same time.
update public.orders set seller_paid_at = paid_at where paid_at is not null;

create index orders_payout_pending_idx on public.orders (ready_at)
    where status in ('READY', 'COLLECTED') and seller_paid_at is null;
