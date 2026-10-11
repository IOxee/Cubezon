-- B5: the server owner's feature panel (web /admin/funciones). Each row overrides one config.yml
-- option of the plugin, which applies it in memory on its next refresh and publishes what is in force
-- as plugin_settings.features. Only this closed list of options; the plugin validates every value again.
create table public.feature_settings (
    key        text primary key check (key in (
        'storage.buy.enabled',
        'computer.buy.enabled',
        'computer.buy.price',
        'computer.delivery.buy.enabled',
        'computer.delivery.buy.price',
        'mailbox.buy.enabled',
        'mailbox.buy.price',
        'mailbox.max-per-player',
        'mailbox.express.enabled',
        'mailbox.express.fee',
        'mailbox.express.fee-to-seller',
        'mailbox.express.hand-delivery',
        'orders.automatic.delay-min-minutes',
        'orders.automatic.delay-max-minutes',
        'orders.roleplay.courier-max-percent')),
    value      text        not null check (char_length(value) between 1 and 32),
    updated_by uuid,
    updated_at timestamptz not null default now()
);

comment on table public.feature_settings is
    'Plugin options changed from the web admin panel (key = config.yml path). Written by the web server, read by the plugin.';

alter table public.feature_settings enable row level security;

-- C9: a photo per product, uploaded from the seller panel by the owner or staff with products.manage.
-- Public bucket (anyone may view), written only by the web server with the secret key. An admin can
-- remove any photo from /admin/fotos.
alter table public.listings
    add column photo_path       text,
    add column photo_updated_at timestamptz;

comment on column public.listings.photo_path is 'Photo in the listing-photos bucket (listings/<id>/photo-<ts>.<ext>), or null.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array ['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Same catalog as 20261009260000, with the photo added at the end (create or replace keeps the grants).
create or replace view public.catalog
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
       lower(translate(l.title || ' ' || l.description || ' ' || s.name || ' ' || replace(l.material, '_', ' ')
                           || ' ' || coalesce(ci.display_name, ''),
                       'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as search_text,
       l.item_key,
       l.match_mode,
       ci.display_name                                       as custom_name,
       ci.icon_path                                          as custom_icon_path,
       l.photo_path                                          as photo_path
from public.listings l
join public.shops s on s.id = l.shop_id and s.status = 'APPROVED'
left join public.custom_items ci on ci.key = l.item_key
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
