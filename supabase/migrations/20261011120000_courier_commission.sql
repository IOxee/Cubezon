-- Courier commission (roleplay mode). Each shop chooses what it pays the employee who carries a
-- package: nothing, a percentage of the goods, a percentage of the express fee, or a fixed amount.
-- It comes out of the seller's payout and the plugin caps it (orders.roleplay.courier-max-percent).
-- The plugin works out the amount when the package is delivered, stores it on the order and pays it
-- with the same claim-before-paying pattern as seller_paid_at: courier_paid_at is set before the
-- money moves and cleared if the payment fails, so a failure can leave someone unpaid, never paid twice.

alter table public.shops
    add column courier_commission_mode text not null default 'NONE'
        check (courier_commission_mode in ('NONE', 'PERCENT_TOTAL', 'PERCENT_EXPRESS', 'FIXED')),
    add column courier_commission_value numeric(14, 2) not null default 0
        check (courier_commission_value >= 0),
    add constraint shops_courier_commission_percent
        check (courier_commission_mode not in ('PERCENT_TOTAL', 'PERCENT_EXPRESS') or courier_commission_value <= 100);

comment on column public.shops.courier_commission_mode is
    'What the shop pays whoever delivers a package: NONE, PERCENT_TOTAL (of the goods), PERCENT_EXPRESS (of the express fee) or FIXED.';
comment on column public.shops.courier_commission_value is
    'Percentage (0-100) or fixed amount, depending on courier_commission_mode.';

alter table public.orders
    add column courier_uuid uuid references public.players (uuid),
    add column courier_amount numeric(14, 2) not null default 0 check (courier_amount >= 0),
    add column courier_paid_at timestamptz,
    add constraint orders_courier_amount_has_courier check (courier_amount = 0 or courier_uuid is not null);

comment on column public.orders.courier_uuid is 'Employee who delivered the package and earned courier_amount (roleplay).';
comment on column public.orders.courier_amount is 'Courier commission, already deducted from the seller payout.';
comment on column public.orders.courier_paid_at is 'Courier payout claimed (set before paying, cleared if it fails).';

-- runJobs retries unpaid commissions.
create index orders_courier_unpaid_idx on public.orders (id)
    where courier_amount > 0 and courier_paid_at is null;
