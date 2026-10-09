/**
 * Pure helpers for the seller panel: sales figures from order rows, order filters and the rules
 * that decide what a seller may do with a listing.
 */

export type OrderStatus = "PENDING" | "PAID" | "READY" | "COLLECTED" | "FAILED" | "REFUNDED";
export type ListingStatus = "ACTIVE" | "PAUSED" | "REMOVED";
export type ShopStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Orders that count as sold (paid by the buyer and not refunded). */
export const SOLD_STATUSES: readonly OrderStatus[] = ["PAID", "READY", "COLLECTED"];
export const OPEN_STATUSES: readonly OrderStatus[] = ["PENDING", "PAID", "READY"];

/** Active listings with this many units or fewer are flagged as low on stock. */
export const LOW_STOCK_THRESHOLD = 3;

export type OrderFigures = { listing_id: string; quantity: number; total: number | string; status: OrderStatus };

export type ListingSales = { unitsSold: number; openOrders: number };

export type SalesSummary = {
  unitsSold: number;
  /** Integer cents, to add up money without floating point errors. */
  revenueCents: number;
  openOrders: number;
  byListing: Map<string, ListingSales>;
};

export function summarizeOrders(rows: readonly OrderFigures[]): SalesSummary {
  const summary: SalesSummary = { unitsSold: 0, revenueCents: 0, openOrders: 0, byListing: new Map() };
  for (const row of rows) {
    const sold = SOLD_STATUSES.includes(row.status);
    const open = OPEN_STATUSES.includes(row.status);
    if (sold) {
      summary.unitsSold += row.quantity;
      summary.revenueCents += Math.round(Number(row.total) * 100);
    }
    if (open) summary.openOrders += 1;

    const listing = summary.byListing.get(row.listing_id) ?? { unitsSold: 0, openOrders: 0 };
    if (sold) listing.unitsSold += row.quantity;
    if (open) listing.openOrders += 1;
    summary.byListing.set(row.listing_id, listing);
  }
  return summary;
}

/** Sales figures of several shops at once (the "Mis tiendas" cards), keyed by shop id. */
export function summarizeOrdersByShop(
  rows: readonly (OrderFigures & { shop_id: string })[],
  shopIds: readonly string[] = [],
): Map<string, SalesSummary> {
  const byShop = new Map<string, OrderFigures[]>(shopIds.map((id) => [id, []]));
  for (const row of rows) {
    const shopRows = byShop.get(row.shop_id) ?? [];
    shopRows.push(row);
    byShop.set(row.shop_id, shopRows);
  }
  return new Map([...byShop].map(([shopId, shopRows]) => [shopId, summarizeOrders(shopRows)]));
}

/** Filters of the orders page: every status plus "open" (in progress). */
export const ORDER_FILTERS = ["all", "open", "PENDING", "PAID", "READY", "COLLECTED", "FAILED", "REFUNDED"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

/** Statuses a filter selects, or null for all of them. */
export function filterStatuses(filter: OrderFilter): readonly OrderStatus[] | null {
  if (filter === "all") return null;
  if (filter === "open") return OPEN_STATUSES;
  return [filter];
}

/** Listings are removed for good, so only while nothing is held in escrow or waiting in an order. */
export function canRemoveListing(listing: {
  status: ListingStatus;
  available: number;
  reserved: number;
  openOrders: number;
}): boolean {
  return listing.status !== "REMOVED" && listing.available === 0 && listing.reserved === 0 && listing.openOrders === 0;
}

/** Material and items per unit are fixed once anything was deposited (escrow rows in any status). */
export function isListingFormatLocked(inventory: {
  available: number;
  reserved: number;
  delivered: number;
  returned: number;
}): boolean {
  return inventory.available + inventory.reserved + inventory.delivered + inventory.returned > 0;
}

/**
 * A suspended shop is frozen: no changes to the shop or its listings. Otherwise everything,
 * name and slug included, can change at any time without a new review (old slugs keep
 * redirecting to the shop).
 */
export function canEditShop(status: ShopStatus): boolean {
  return status !== "SUSPENDED";
}

export function isLowStock(listing: { status: ListingStatus; available: number }): boolean {
  return listing.status === "ACTIVE" && listing.available <= LOW_STOCK_THRESHOLD;
}
