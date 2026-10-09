-- Cubezon: how a listing accepts items with NBT, and sellers withdrawing unsold stock.
--   KEY:   any item with the listing's item_key (any durability, enchantments, name...).
--   EXACT: only items identical to `sample` (an ItemStack#serializeAsBytes of one item, set in-game
--          from the company computer). The web can show the sample (name, enchantments, lore).
-- Withdrawn units (owner takes unsold stock back) use the existing escrow status RETURNED.

alter table public.listings
    add column match_mode text not null default 'KEY' check (match_mode in ('KEY', 'EXACT')),
    add column sample bytea,
    add column sample_set_at timestamptz,
    add constraint listings_exact_has_sample check (match_mode = 'KEY' or sample is not null);

-- When stock was taken back by the seller.
alter table public.escrow_items
    add column returned_at timestamptz;
