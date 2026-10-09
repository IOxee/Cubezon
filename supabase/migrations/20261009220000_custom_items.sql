-- Cubezon: items from other plugins and mods.
-- A listing is now identified by item_key, a namespaced key the plugin computes from the item:
--   minecraft:diamond            vanilla
--   create:wrench                mods on hybrid servers (their own namespace)
--   itemsadder:myitems:ruby      ItemsAdder (namespace:id)
--   nexo:ruby, oraxen:ruby       Nexo / Oraxen
--   mmoitems:SWORD:FIRE_SWORD    MMOItems (type:id)
--   slimefun:ELECTRIC_MOTOR      Slimefun
--   ecoitems:ruby                EcoItems
--   <namespace>:<value>          any plugin, through PDC keys listed in the plugin's config.yml
-- `material` stays as the vanilla base item (icon fallback, categories). For vanilla listings
-- item_key = 'minecraft:' || material, filled in automatically when an insert leaves it empty.

alter table public.listings
    add column item_key text;

update public.listings set item_key = 'minecraft:' || material where item_key is null;

alter table public.listings
    alter column item_key set not null,
    add constraint listings_item_key_format check (item_key ~ '^[a-z0-9_.-]+:[A-Za-z0-9_./:-]+$');

create function public.default_listing_item_key() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if new.item_key is null then
        new.item_key = 'minecraft:' || new.material;
    end if;
    return new;
end;
$$;

create trigger listings_default_item_key
    before insert or update of material, item_key on public.listings
    for each row execute function public.default_listing_item_key();

create index listings_item_key_idx on public.listings (item_key);

-- Catalog of custom items, registered in-game by an admin (/cz item register)

create table public.custom_items (
    key           text primary key check (key ~ '^[a-z0-9_.-]+:[A-Za-z0-9_./:-]+$'),
    display_name  text        not null check (char_length(display_name) between 1 and 80),
    base_material text        not null check (base_material ~ '^[a-z0-9_]+$'), -- vanilla id, icon fallback
    max_stack     integer     not null check (max_stack between 1 and 99),
    source        text        not null, -- what recognised it: itemsadder, nexo, pdc, vanilla...
    sample        bytea       not null, -- ItemStack#serializeAsBytes of one item, for previews
    icon_path     text,                 -- uploaded by an admin on the web
    registered_by uuid        not null references public.players (uuid),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create trigger custom_items_set_updated_at
    before update on public.custom_items
    for each row execute function public.set_updated_at();

alter table public.custom_items enable row level security;

create policy "Custom items are public"
    on public.custom_items for select
    to anon, authenticated
    using (true);
