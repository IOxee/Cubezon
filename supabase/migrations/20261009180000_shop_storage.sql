-- Cubezon: shop zones and storage blocks.
-- A shop's capacity (units it can hold in escrow) is the sum of the "Almacén Cubezon" blocks
-- placed inside its zone. Items stay in escrow_items; the blocks only set the limit.

-- Shop zone: a cuboid set in-game by an admin (/cz shop zone <slug>)

alter table public.shops
    add column zone_world text,
    add column zone_min_x integer,
    add column zone_min_y integer,
    add column zone_min_z integer,
    add column zone_max_x integer,
    add column zone_max_y integer,
    add column zone_max_z integer,
    add constraint shops_zone_complete check (
        num_nulls(zone_world, zone_min_x, zone_min_y, zone_min_z, zone_max_x, zone_max_y, zone_max_z) in (0, 7)
    ),
    add constraint shops_zone_ordered check (
        zone_min_x <= zone_max_x and zone_min_y <= zone_max_y and zone_min_z <= zone_max_z
    );

-- Two shops can never share blocks.
create function public.check_shop_zone_overlap() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if new.zone_world is null then
        return new;
    end if;
    if exists (
        select 1 from public.shops s
        where s.id <> new.id
          and s.zone_world = new.zone_world
          and s.zone_min_x <= new.zone_max_x and new.zone_min_x <= s.zone_max_x
          and s.zone_min_y <= new.zone_max_y and new.zone_min_y <= s.zone_max_y
          and s.zone_min_z <= new.zone_max_z and new.zone_min_z <= s.zone_max_z
    ) then
        raise exception 'Shop zone overlaps another shop' using errcode = 'exclusion_violation';
    end if;
    return new;
end;
$$;

create trigger shops_check_zone_overlap
    before insert or update of zone_world, zone_min_x, zone_min_y, zone_min_z, zone_max_x, zone_max_y, zone_max_z
    on public.shops
    for each row execute function public.check_shop_zone_overlap();

-- Storage blocks

create table public.storage_blocks (
    id         uuid primary key default gen_random_uuid(),
    shop_id    uuid        not null references public.shops (id) on delete cascade,
    world      text        not null,
    x          integer     not null,
    y          integer     not null,
    z          integer     not null,
    capacity   integer     not null check (capacity between 1 and 54), -- units; config value when placed
    placed_by  uuid        not null references public.players (uuid),
    created_at timestamptz not null default now(),
    unique (world, x, y, z)
);

create index storage_blocks_shop_idx on public.storage_blocks (shop_id);

alter table public.storage_blocks enable row level security;
-- No policies: only the plugin (owner role) and the web server (secret key) read it.

-- Capacity and usage per shop (private: no grants to anon/authenticated).
create view public.shop_storage
    with (security_invoker = true)
as
select s.id as shop_id,
       coalesce(b.blocks, 0)::integer   as storage_blocks,
       coalesce(b.capacity, 0)::integer as capacity_units,
       coalesce(u.used, 0)::integer     as used_units
from public.shops s
left join (
    select shop_id, count(*) as blocks, sum(capacity) as capacity
    from public.storage_blocks
    group by shop_id
) b on b.shop_id = s.id
left join (
    select l.shop_id, count(*) as used
    from public.escrow_items e
    join public.listings l on l.id = e.listing_id
    where e.status in ('AVAILABLE', 'RESERVED')
    group by l.shop_id
) u on u.shop_id = s.id;

revoke all on public.shop_storage from anon, authenticated;
