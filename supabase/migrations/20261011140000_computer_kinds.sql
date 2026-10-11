-- Two kinds of company computer (roleplay mode):
--   FULL      the shop's control panel; only inside the shop's zone (as before).
--   DELIVERY  a terminal that only prints the packages of accepted orders; it can be placed outside
--             the zone (a depot), never in another shop's zone. Its item is bought from the shop's
--             FULL computer and carries the shop it belongs to.
-- Existing computers are FULL.

alter table public.shop_computers
    add column kind text not null default 'FULL' check (kind in ('FULL', 'DELIVERY'));

comment on column public.shop_computers.kind is
    'FULL: shop control panel inside its zone. DELIVERY: package printing terminal, may be outside the zone.';
