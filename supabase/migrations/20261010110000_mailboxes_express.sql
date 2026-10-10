-- Cubezon: personal mailboxes and express delivery.
-- Each player can place mailboxes (plugin_settings 'max_mailboxes', from config.yml
-- mailbox.max-per-player; 1 if missing). At checkout the web lets the buyer choose:
--   LOCKER   (as before): locker_id set, delivered by a courier in roleplay mode.
--   MAILBOX  (express):   mailbox_id set, locker_id null; delivered straight to the mailbox once the
--                         order is processed (automatic) or accepted (roleplay), for express_fee extra.
-- express_fee is charged to the buyer on top of total (total stays unit_price * quantity). It goes
-- to the server (money sink) or to the seller, as config.yml mailbox.express.fee-to-seller says.
-- Web settings published by the plugin: 'express_enabled' (true/false), 'express_fee' (decimal).
-- New failure_reason: MAILBOX_UNAVAILABLE (FAILED, nothing charged).

create table public.mailboxes (
    id         uuid primary key default gen_random_uuid(),
    owner_uuid uuid        not null references public.players (uuid) on delete cascade,
    world      text        not null,
    x          integer     not null,
    y          integer     not null,
    z          integer     not null,
    created_at timestamptz not null default now(),
    unique (world, x, y, z)
);

create index mailboxes_owner_idx on public.mailboxes (owner_uuid);

alter table public.mailboxes enable row level security;
-- No policies: the plugin and the web server (secret key) read them.

create function public.check_mailbox_limit() returns trigger
    language plpgsql
    set search_path = ''
as $$
declare
    v_max integer := coalesce(
        (select case when value ~ '^[0-9]{1,3}$' then value::integer end
         from public.plugin_settings where key = 'max_mailboxes'), 1);
begin
    perform pg_advisory_xact_lock(hashtext('mailboxes:' || new.owner_uuid::text));
    if (select count(*) from public.mailboxes where owner_uuid = new.owner_uuid) >= v_max then
        raise exception 'MAILBOXES_EXCEEDED: % mailboxes max', v_max using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger mailboxes_check_limit
    before insert on public.mailboxes
    for each row execute function public.check_mailbox_limit();

-- Orders: delivery method

alter table public.orders
    alter column locker_id drop not null,
    add column delivery_method text not null default 'LOCKER' check (delivery_method in ('LOCKER', 'MAILBOX')),
    add column mailbox_id uuid references public.mailboxes (id) on delete set null,
    add column express_fee numeric(14, 2) not null default 0 check (express_fee >= 0),
    add constraint orders_delivery_target check (
        (delivery_method = 'LOCKER' and locker_id is not null and mailbox_id is null)
        or (delivery_method = 'MAILBOX' and locker_id is null
            and (mailbox_id is not null or status not in ('PENDING', 'PAID', 'READY')))
    );

-- Express orders must go to a mailbox of the buyer.
create function public.check_order_mailbox() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if new.mailbox_id is not null
       and not exists (select 1 from public.mailboxes b where b.id = new.mailbox_id and b.owner_uuid = new.buyer_uuid) then
        raise exception 'MAILBOX_OF_ANOTHER_PLAYER' using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger orders_check_mailbox
    before insert or update of mailbox_id, buyer_uuid on public.orders
    for each row execute function public.check_order_mailbox();

create index orders_mailbox_ready_idx on public.orders (buyer_uuid, mailbox_id) where status = 'READY';
create index orders_mailbox_idx on public.orders (mailbox_id) where mailbox_id is not null;
