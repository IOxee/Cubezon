-- Cubezon: storage block types defined by admins.
-- Any solid block can be a storage type with its own capacity and price (created in-game with
-- /cz storage type create, holding the block). Placed blocks keep the capacity they were placed
-- with, so changing or removing a type never changes existing storage.

create table public.storage_types (
    id           text primary key check (id ~ '^[a-z0-9_-]{2,32}$'),
    display_name text           not null check (char_length(display_name) between 1 and 40),
    material     text           not null check (material ~ '^[a-z0-9_]+$'), -- vanilla block id
    capacity     integer        not null check (capacity between 1 and 10000),
    price        numeric(14, 2) not null check (price >= 0),
    buyable      boolean        not null default true,
    created_by   uuid           references public.players (uuid),
    created_at   timestamptz    not null default now(),
    updated_at   timestamptz    not null default now()
);

create trigger storage_types_set_updated_at
    before update on public.storage_types
    for each row execute function public.set_updated_at();

alter table public.storage_types enable row level security;

create policy "Storage types are public"
    on public.storage_types for select
    to anon, authenticated
    using (true);

-- The block every shop had until now.
insert into public.storage_types (id, display_name, material, capacity, price)
values ('barrel', 'Almacén Cubezon', 'barrel', 27, 1000);

alter table public.storage_blocks
    add column type_id text references public.storage_types (id) on delete set null;

update public.storage_blocks set type_id = 'barrel' where type_id is null;

-- Admin types can hold more than a barrel.
alter table public.storage_blocks
    drop constraint storage_blocks_capacity_check,
    add constraint storage_blocks_capacity_check check (capacity between 1 and 10000);
