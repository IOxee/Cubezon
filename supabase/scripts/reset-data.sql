-- DESTRUCTIVE: deletes ALL data in schema public and keeps the schema (tables, views, functions,
-- triggers, policies). Run it by hand against the DEVELOPMENT database only. It is not a migration:
-- never put it in supabase/migrations.
--
-- Before running:
--   1. Stop the game server (the plugin must not be writing while this runs).
--   2. Remember that escrow_items holds the deposited items as bytes: once deleted they are gone
--      for good (the in-game items were already taken out of the players' hands).
--
-- Kept on purpose: inks (seed colours) and plugin_settings (the plugin republishes it on startup).
-- storage_types references players, so the cascade empties it too: its default 'barrel' row (seed
-- from migration 20261009250000) is inserted again at the end.
-- Not touched: Storage buckets/files (shop-media, item-icons); empty them from the dashboard
-- (Storage) if you also want the uploaded logos and covers gone.

begin;

truncate table
  public.order_events,
  public.orders,
  public.escrow_items,
  public.reviews,
  public.listings,
  public.custom_items,
  public.storage_blocks,
  public.shop_computers,
  public.mailboxes,
  public.lockers,
  public.shop_members,
  public.shop_roles,
  public.shop_slug_history,
  public.shops,
  public.staff,
  public.themes,
  public.web_sessions,
  public.link_codes,
  public.players
restart identity cascade;

-- Same seed as migration 20261009250000 (the cascade above emptied storage_types).
insert into public.storage_types (id, display_name, material, capacity, price)
values ('barrel', 'Almacén Cubezon', 'barrel', 27, 1000)
on conflict (id) do nothing;

commit;
