-- Catalog with items from other plugins and mods (custom_items) and the listing match mode.
-- Same columns as before (same names and types, as create or replace requires) plus new ones at
-- the end. A custom item's display name also feeds the search text.

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
       ci.icon_path                                          as custom_icon_path
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

-- Icons of custom items, uploaded by staff on the web (server side, with the secret key).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-icons', 'item-icons', true, 524288, array['image/png', 'image/webp'])
on conflict (id) do nothing;
