-- 20261011120000 gave orders.courier_uuid a foreign key to players. With two foreign keys from
-- orders to players (buyer_uuid and courier_uuid), PostgREST can no longer resolve the web's
-- `buyer:players(name)` embeds and those queries fail (PGRST201), which broke the seller panel.
-- Only the plugin writes courier_uuid, always with a player who works in the shop (shop_members
-- references players), so the constraint is not needed: drop it and keep a plain uuid column.

alter table public.orders drop constraint orders_courier_uuid_fkey;

comment on column public.orders.courier_uuid is
    'Employee who delivered the package and earned courier_amount (roleplay). No foreign key on purpose: '
    'a second orders -> players key would make the web''s players embeds ambiguous.';
