-- Cubezon: order processing by the plugin.
-- The plugin claims a PENDING order (sets processing_started_at and reserves escrow units in one
-- transaction), charges the buyer and pays the seller with Vault, then moves it to PAID and READY.
-- A PENDING order with processing_started_at set and no later status means the plugin stopped in
-- the middle: on startup it is failed with reason INTERRUPTED and logged for an admin to check
-- the payment, so a buyer is never charged twice.
--
-- failure_reason codes written by the plugin (the web translates them):
--   OUT_OF_STOCK, LISTING_UNAVAILABLE, LOCKER_UNAVAILABLE, INVALID_ITEM, INSUFFICIENT_FUNDS,
--   PAYMENT_ERROR, INTERRUPTED. REFUNDED orders use PAYOUT_FAILED (seller could not be paid).

alter table public.orders
    add column processing_started_at timestamptz;

-- Orders claimed but not finished (startup recovery).
create index orders_processing_idx on public.orders (processing_started_at)
    where status = 'PENDING' and processing_started_at is not null;
