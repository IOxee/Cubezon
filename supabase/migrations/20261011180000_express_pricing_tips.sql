-- Express pricing per shop and buyer tips.
--
-- shops.express_fee: the shop's own express fee, used when the server lets shops set it
-- (plugin config mailbox.express.pricing = shop | shop-capped, published as express_pricing, with
-- the cap express_max_fee). Null = the server's fee (express_fee in plugin_settings).
--
-- orders.tip: an optional tip the buyer adds at checkout (tips_enabled, tips_max). The plugin charges
-- it with the order (total + express_fee + tip), pays it to the employee who delivers it or, with no
-- courier, to the shop, and gives it back on a refund.

alter table public.shops
    add column express_fee numeric(14, 2) check (express_fee >= 0);

comment on column public.shops.express_fee is
    'Express fee this shop charges when the server lets shops set it (express_pricing); null = the server''s.';

alter table public.orders
    add column tip numeric(14, 2) not null default 0 check (tip >= 0);

comment on column public.orders.tip is
    'Tip the buyer added; charged with the order, paid to the courier (or the shop without one).';

-- The web feature panel can now also change the pricing mode, the cap and the tips.
alter table public.feature_settings drop constraint feature_settings_key_check;
alter table public.feature_settings add constraint feature_settings_key_check check (key in (
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
    'mailbox.express.pricing',
    'mailbox.express.max-fee',
    'mailbox.express.fee-to-seller',
    'mailbox.express.hand-delivery',
    'orders.automatic.delay-min-minutes',
    'orders.automatic.delay-max-minutes',
    'orders.roleplay.courier-max-percent',
    'orders.tips.enabled',
    'orders.tips.max'));
