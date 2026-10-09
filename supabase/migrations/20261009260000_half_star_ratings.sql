-- Reviews accept half stars: 0.5 to 5 in steps of 0.5 (was a whole number from 1 to 5).
-- The three views that read reviews.rating are dropped and recreated unchanged around the type
-- change (Postgres cannot alter a column a view depends on).

drop view public.catalog;
drop view public.shop_directory;
drop view public.public_reviews;

alter table public.reviews drop constraint reviews_rating_check;

alter table public.reviews
    alter column rating type numeric(2, 1) using rating::numeric(2, 1),
    add constraint reviews_rating_check check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

-- Same definitions as before (20261009240000 catalog, 20261009211000 shop_directory,
-- 20261009163000 public_reviews)

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
       rating.total     as rating_count,
       s.tagline,
       s.logo_path,
       s.banner_path
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

revoke all on public.catalog, public.shop_directory, public.public_reviews from anon, authenticated;
grant select on public.catalog, public.shop_directory, public.public_reviews to anon, authenticated;
