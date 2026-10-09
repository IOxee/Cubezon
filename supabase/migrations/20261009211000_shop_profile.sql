-- Public shop profile (logo, banner, tagline, featured listings, optional location) and a slug
-- history so links keep working after a shop changes its slug. Owners can rename a shop or
-- change its slug at any time: orders, listings, escrow and the plugin all use the shop id.

alter table public.shops
    add column tagline              text    not null default '' check (char_length(tagline) <= 80),
    add column logo_path            text check (char_length(logo_path) <= 200),
    add column banner_path          text check (char_length(banner_path) <= 200),
    add column featured_listing_ids uuid[]  not null default '{}' check (cardinality(featured_listing_ids) <= 4),
    add column show_location        boolean not null default false;

-- Slug history: /t/<old-slug> redirects to the shop's current slug

create table public.shop_slug_history (
    slug       text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    shop_id    uuid        not null references public.shops (id) on delete cascade,
    changed_at timestamptz not null default now()
);

create index shop_slug_history_shop_idx on public.shop_slug_history (shop_id);

alter table public.shop_slug_history enable row level security;

create policy "Slug history of approved shops is public"
    on public.shop_slug_history for select
    to anon, authenticated
    using (exists (select 1 from public.shops s where s.id = shop_id and s.status = 'APPROVED'));

-- Records the old slug on every change, and stops a shop from taking a slug that another shop
-- used before, so an old link can never lead to a different shop.
create function public.track_shop_slug() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if exists (select 1 from public.shop_slug_history h where h.slug = new.slug and h.shop_id <> new.id) then
        raise exception 'Slug % belonged to another shop', new.slug using errcode = 'unique_violation';
    end if;
    if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
        -- A shop may take back one of its own old slugs.
        delete from public.shop_slug_history where slug = new.slug;
        insert into public.shop_slug_history (slug, shop_id)
        values (old.slug, old.id)
        on conflict (slug) do update set shop_id = excluded.shop_id, changed_at = now();
    end if;
    return new;
end;
$$;

create trigger shops_track_slug
    before insert or update of slug on public.shops
    for each row execute function public.track_shop_slug();

-- Shop directory: same columns plus the profile ones (appended, as create or replace requires)

create or replace view public.shop_directory
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

-- Images: public bucket; only the web server (secret key) uploads, after checking the owner.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
