-- Cubezon: what the web marketplace needs on top of the initial schema.
-- Shop inks, staff roles, reviews and admin themes, plus read-only views for the public
-- catalog and two functions only the web server (secret key) can call.
-- It does not change orders, escrow or the payment flow: the plugin is still the only
-- authority over money and items.

-- Shop inks: fixed palette of 8, editable by a superadmin later (contrast checked by the web)

create table public.inks (
    key        text primary key check (key ~ '^[a-z]+$'),
    name       text        not null check (char_length(name) between 2 and 30),
    light      text        not null check (light ~ '^#[0-9A-F]{6}$'),
    dark       text        not null check (dark ~ '^#[0-9A-F]{6}$'),
    position   smallint    not null default 0,
    created_at timestamptz not null default now()
);

insert into public.inks (key, name, light, dark, position)
values ('azul', 'Azul tampón', '#234C8A', '#8FB2E8', 1),
       ('burdeos', 'Burdeos', '#8A2340', '#F09AB2', 2),
       ('botella', 'Botella', '#2B5E3F', '#8FCFA5', 3),
       ('violeta', 'Violeta', '#5B3A8C', '#BFA6EE', 4),
       ('petroleo', 'Petróleo', '#1D5E66', '#86CBD3', 5),
       ('sepia', 'Sepia', '#6E4A22', '#D9B48A', 6),
       ('grafito', 'Grafito', '#3F4448', '#BFC4C8', 7),
       ('teja', 'Teja', '#9A3B1C', '#F2A285', 8);

-- Shops: chosen ink, official flag (Cubezon's own shop) and the admin's review note

alter table public.shops
    add column ink         text    not null default 'grafito' references public.inks (key),
    add column official    boolean not null default false,
    add column review_note text check (char_length(review_note) <= 300);

-- Catalog lookups by listing (sales counts).
create index orders_listing_idx on public.orders (listing_id);

-- Staff of the web (admins approve shops; superadmins also manage themes and staff).
-- The first superadmin is added by hand: see docs/web.md.

create type public.staff_role as enum ('ADMIN', 'SUPERADMIN');

create table public.staff (
    player_uuid uuid primary key references public.players (uuid) on delete cascade,
    role        public.staff_role not null default 'ADMIN',
    granted_by  uuid references public.players (uuid),
    created_at  timestamptz       not null default now()
);

-- Reviews: one per collected order, so every review is a verified purchase

create table public.reviews (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid        not null unique references public.orders (id) on delete cascade,
    listing_id  uuid        not null references public.listings (id),
    shop_id     uuid        not null references public.shops (id),
    author_uuid uuid        not null references public.players (uuid),
    rating      smallint    not null check (rating between 1 and 5),
    body        text        not null default '' check (char_length(body) <= 1000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index reviews_listing_idx on public.reviews (listing_id);
create index reviews_shop_idx on public.reviews (shop_id);

create trigger reviews_set_updated_at
    before update on public.reviews
    for each row execute function public.set_updated_at();

create function public.check_review_order() returns trigger
    language plpgsql
    set search_path = ''
as $$
declare
    o public.orders%rowtype;
begin
    select * into o from public.orders where id = new.order_id;
    if not found
        or o.status <> 'COLLECTED'
        or o.buyer_uuid <> new.author_uuid
        or o.listing_id <> new.listing_id
        or o.shop_id <> new.shop_id then
        raise exception 'A review must match a collected order of its author'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger reviews_check_order
    before insert or update of order_id, listing_id, shop_id, author_uuid on public.reviews
    for each row execute function public.check_review_order();

-- Themes: alternative values for the existing design tokens, e.g.
-- {"light": {"paper": "#ECE5D3"}, "dark": {"paper": "#161915"}}. The web validates contrast.

create table public.themes (
    id         uuid primary key default gen_random_uuid(),
    name       text        not null unique check (char_length(name) between 3 and 40),
    tokens     jsonb       not null default '{}'::jsonb check (jsonb_typeof(tokens) = 'object'),
    is_active  boolean     not null default false,
    starts_at  timestamptz,
    ends_at    timestamptz,
    created_by uuid references public.players (uuid),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((starts_at is null) = (ends_at is null)),
    check (ends_at > starts_at)
);

-- At most one theme is active by hand at a time.
create unique index themes_single_active_idx on public.themes (is_active) where is_active;

create trigger themes_set_updated_at
    before update on public.themes
    for each row execute function public.set_updated_at();

-- The theme to apply right now: a scheduled theme inside its window beats the one active by
-- hand. No row means the base theme ("Cartilla").
create view public.current_theme
    with (security_invoker = false)
as
select id, name, tokens
from public.themes
where (starts_at is not null and starts_at <= now() and now() < ends_at)
   or (starts_at is null and is_active)
order by (starts_at is not null) desc, starts_at desc
limit 1;

-- Activates one theme (or none with null) in a single transaction.
create function public.set_active_theme(p_theme_id uuid) returns void
    language sql
    set search_path = ''
as $$
    update public.themes set is_active = false where is_active and id is distinct from p_theme_id;
    update public.themes set is_active = true where id = p_theme_id;
$$;

-- Catalog

-- Material id -> catalog category. The first matching rule wins.
create function public.material_category(material text) returns text
    language sql
    immutable
    parallel safe
    set search_path = ''
as $$
select case
    when material ~ '_(helmet|chestplate|leggings|boots|horse_armor)$'
        or material in ('elytra', 'wolf_armor') then 'armor'
    when material ~ '_sword$'
        or material in ('bow', 'crossbow', 'trident', 'mace', 'shield', 'arrow', 'spectral_arrow',
                        'tipped_arrow', 'wind_charge', 'fire_charge') then 'combat'
    when material ~ '^cooked_|_(stew|soup|pie)$'
        or material in ('apple', 'golden_apple', 'enchanted_golden_apple', 'bread', 'cookie', 'cake',
                        'melon_slice', 'sweet_berries', 'glow_berries', 'carrot', 'golden_carrot', 'potato',
                        'baked_potato', 'poisonous_potato', 'beetroot', 'dried_kelp', 'honey_bottle',
                        'chorus_fruit', 'milk_bucket', 'beef', 'porkchop', 'chicken', 'mutton', 'rabbit',
                        'cod', 'salmon', 'tropical_fish', 'pufferfish', 'rotten_flesh', 'spider_eye') then 'food'
    when material ~ '_(pickaxe|axe|shovel|hoe|bucket)$'
        or material in ('fishing_rod', 'shears', 'flint_and_steel', 'brush', 'spyglass', 'compass',
                        'recovery_compass', 'clock', 'lead', 'name_tag', 'bucket', 'carrot_on_a_stick',
                        'warped_fungus_on_a_stick', 'saddle', 'bundle', 'map', 'filled_map') then 'tools'
    when material in ('potion', 'splash_potion', 'lingering_potion', 'enchanted_book', 'experience_bottle',
                      'totem_of_undying', 'ender_pearl', 'ender_eye', 'blaze_rod', 'blaze_powder', 'ghast_tear',
                      'nether_star', 'dragon_breath', 'dragon_egg', 'end_crystal', 'beacon', 'enchanting_table',
                      'brewing_stand', 'glass_bottle', 'nether_wart', 'fermented_spider_eye', 'magma_cream',
                      'phantom_membrane', 'heart_of_the_sea', 'conduit', 'book', 'writable_book',
                      'written_book', 'breeze_rod', 'heavy_core', 'ominous_bottle', 'trial_key',
                      'ominous_trial_key', 'echo_shard', 'glistering_melon_slice', 'rabbit_foot') then 'magic'
    when material ~ '_(button|pressure_plate|rail)$'
        or material in ('redstone', 'redstone_block', 'redstone_torch', 'redstone_lamp', 'repeater',
                        'comparator', 'piston', 'sticky_piston', 'observer', 'hopper', 'dispenser', 'dropper',
                        'lever', 'daylight_detector', 'target', 'tripwire_hook', 'note_block', 'jukebox', 'tnt',
                        'slime_block', 'honey_block', 'crafter', 'sculk_sensor', 'calibrated_sculk_sensor',
                        'lightning_rod', 'trapped_chest', 'rail', 'minecart', 'chest_minecart',
                        'hopper_minecart', 'tnt_minecart', 'furnace_minecart') then 'redstone'
    when material ~ '_(ingot|nugget|dye|shard|scrap)$|^raw_(iron|gold|copper)$'
        or material in ('diamond', 'emerald', 'coal', 'charcoal', 'lapis_lazuli', 'quartz', 'flint', 'stick',
                        'string', 'feather', 'leather', 'bone', 'bone_meal', 'gunpowder', 'slime_ball', 'paper',
                        'sugar', 'sugar_cane', 'wheat', 'wheat_seeds', 'clay_ball', 'brick', 'nether_brick',
                        'glowstone_dust', 'prismarine_crystals', 'rabbit_hide', 'turtle_scute',
                        'armadillo_scute', 'ink_sac', 'glow_ink_sac', 'honeycomb', 'resin_clump', 'egg',
                        'snowball') then 'materials'
    when material ~ '_(banner|bed|carpet|candle|sign|hanging_sign|lantern|pottery_sherd|head|skull|tulip|banner_pattern)$'
        or material in ('painting', 'item_frame', 'glow_item_frame', 'armor_stand', 'flower_pot', 'lantern',
                        'torch', 'soul_torch', 'decorated_pot', 'bookshelf', 'chiseled_bookshelf', 'campfire',
                        'soul_campfire', 'bell', 'candle', 'dandelion', 'poppy', 'blue_orchid', 'allium',
                        'azure_bluet', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose',
                        'sunflower', 'lilac', 'rose_bush', 'peony', 'torchflower', 'pitcher_plant',
                        'pink_petals', 'spore_blossom', 'flowering_azalea', 'azalea', 'lily_pad', 'end_rod',
                        'chain', 'iron_bars') then 'decoration'
    when material ~ '_(block|planks|log|wood|stem|hyphae|stairs|slab|wall|fence|fence_gate|door|trapdoor|bricks|tiles|ore|concrete|concrete_powder|terracotta|wool|glass|glass_pane|stone|sandstone|leaves|sapling|deepslate|froglight|ice|shulker_box)$'
        or material in ('stone', 'cobblestone', 'mossy_cobblestone', 'dirt', 'coarse_dirt', 'rooted_dirt',
                        'grass_block', 'podzol', 'mycelium', 'sand', 'red_sand', 'gravel', 'clay', 'obsidian',
                        'crying_obsidian', 'netherrack', 'end_stone', 'glowstone', 'ice', 'snow', 'deepslate',
                        'cobbled_deepslate', 'tuff', 'calcite', 'granite', 'diorite', 'andesite', 'basalt',
                        'blackstone', 'mud', 'prismarine', 'bricks', 'glass', 'chest', 'barrel', 'furnace',
                        'blast_furnace', 'smoker', 'crafting_table', 'anvil', 'ladder', 'scaffolding', 'cactus',
                        'pumpkin', 'melon', 'sponge', 'wet_sponge', 'soul_sand', 'soul_soil', 'bedrock',
                        'ancient_debris', 'sculk', 'loom', 'cartography_table', 'fletching_table',
                        'smithing_table', 'stonecutter', 'grindstone', 'lectern', 'composter', 'cauldron',
                        'ender_chest', 'shulker_box') then 'blocks'
    else 'misc'
end
$$;

-- Public listing cards: active listings of approved shops with stock, sales and rating.
-- Runs as its owner (escrow, orders and reviews have no public policy), so it exposes only
-- public columns and filters to the public catalog itself.
create view public.catalog
    with (security_invoker = false)
as
select l.id,
       l.title,
       l.description,
       l.material,
       public.material_category(l.material)                  as category,
       l.unit_amount,
       l.unit_price,
       round(l.unit_price / l.unit_amount, 2)                as price_per_item,
       l.created_at,
       l.updated_at,
       s.id                                                  as shop_id,
       s.slug                                                as shop_slug,
       s.name                                                as shop_name,
       s.ink                                                 as shop_ink,
       s.official                                            as shop_official,
       stock.units                                           as units_available,
       sales.units                                           as units_sold,
       rating.average                                        as rating_avg,
       rating.total                                          as rating_count,
       lower(translate(l.title || ' ' || l.description || ' ' || s.name || ' ' || replace(l.material, '_', ' '),
                       'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as search_text
from public.listings l
join public.shops s on s.id = l.shop_id and s.status = 'APPROVED'
cross join lateral (
    select count(*)::integer as units
    from public.escrow_items e
    where e.listing_id = l.id and e.status = 'AVAILABLE'
) stock
cross join lateral (
    select coalesce(sum(o.quantity), 0)::integer as units
    from public.orders o
    where o.listing_id = l.id and o.status in ('PAID', 'READY', 'COLLECTED')
) sales
cross join lateral (
    select round(avg(r.rating), 2) as average, count(*)::integer as total
    from public.reviews r
    where r.listing_id = l.id
) rating
where l.status = 'ACTIVE';

-- Public shop directory: approved shops with their numbers.
create view public.shop_directory
    with (security_invoker = false)
as
select s.id,
       s.slug,
       s.name,
       s.description,
       s.ink,
       s.official,
       s.created_at,
       p.name           as owner_name,
       listings.total   as listing_count,
       sales.units      as units_sold,
       rating.average   as rating_avg,
       rating.total     as rating_count
from public.shops s
join public.players p on p.uuid = s.owner_uuid
cross join lateral (
    select count(*)::integer as total
    from public.listings l
    where l.shop_id = s.id and l.status = 'ACTIVE'
) listings
cross join lateral (
    select coalesce(sum(o.quantity), 0)::integer as units
    from public.orders o
    where o.shop_id = s.id and o.status in ('PAID', 'READY', 'COLLECTED')
) sales
cross join lateral (
    select round(avg(r.rating), 2) as average, count(*)::integer as total
    from public.reviews r
    where r.shop_id = s.id
) rating
where s.status = 'APPROVED';

-- Public reviews of approved shops, with the author's in-game name only.
create view public.public_reviews
    with (security_invoker = false)
as
select r.id,
       r.listing_id,
       r.shop_id,
       r.rating,
       r.body,
       r.created_at,
       r.updated_at,
       p.name  as author_name,
       l.title as listing_title
from public.reviews r
join public.players p on p.uuid = r.author_uuid
join public.listings l on l.id = r.listing_id
join public.shops s on s.id = r.shop_id and s.status = 'APPROVED';

-- Units per escrow status for every listing (seller panel and admin, secret key only).
create view public.listing_inventory
    with (security_invoker = true)
as
select l.id                                                         as listing_id,
       count(e.id) filter (where e.status = 'AVAILABLE')::integer  as available,
       count(e.id) filter (where e.status = 'RESERVED')::integer   as reserved,
       count(e.id) filter (where e.status = 'DELIVERED')::integer  as delivered,
       count(e.id) filter (where e.status = 'RETURNED')::integer   as returned
from public.listings l
left join public.escrow_items e on e.listing_id = l.id
group by l.id;

-- Web login: redeems a /cubezon link code and opens a session in one transaction.
-- Returns no row when the code is unknown, expired or already used.

create function public.redeem_link_code(p_code text, p_token_hash text, p_session_days integer)
    returns table (player_id uuid, player_name text)
    language plpgsql
    set search_path = ''
as $$
declare
    v_player uuid;
begin
    update public.link_codes
    set redeemed_at = now()
    where code = upper(p_code)
      and redeemed_at is null
      and expires_at > now()
    returning link_codes.player_uuid into v_player;

    if v_player is null then
        return;
    end if;

    delete from public.web_sessions where player_uuid = v_player and expires_at < now();

    insert into public.web_sessions (token_hash, player_uuid, expires_at, last_used_at)
    values (p_token_hash, v_player, now() + make_interval(days => p_session_days), now());

    return query select p.uuid, p.name from public.players p where p.uuid = v_player;
end;
$$;

-- Row Level Security and grants

alter table public.inks enable row level security;
alter table public.staff enable row level security;
alter table public.reviews enable row level security;
alter table public.themes enable row level security;

create policy "Inks are public"
    on public.inks for select
    to anon, authenticated
    using (true);

-- Views that run as their owner: expose them read-only.
revoke all on public.catalog, public.shop_directory, public.public_reviews, public.current_theme
    from anon, authenticated;
grant select on public.catalog, public.shop_directory, public.public_reviews, public.current_theme
    to anon, authenticated;

-- Private: only the web server (secret key) and the plugin.
revoke all on public.listing_inventory from anon, authenticated;

revoke execute on function public.redeem_link_code(text, text, integer) from public, anon, authenticated;
revoke execute on function public.set_active_theme(uuid) from public, anon, authenticated;
grant execute on function public.redeem_link_code(text, text, integer) to service_role;
grant execute on function public.set_active_theme(uuid) to service_role;
