import { centsToDecimal, toCents } from "@/lib/format";

/**
 * Cart stored in the cz-cart cookie as JSON: [[listingId, units], ...].
 * Pure helpers (no Next APIs) so they can be unit tested; read/write the cookie in Server
 * Actions with cookies() from next/headers. Also the pure checkout checks used by placeOrder.
 */

export const CART_COOKIE = "cz-cart";
export const CART_MAX_LINES = 30;
/** Same limit as orders.quantity in the database. */
export const MAX_UNITS_PER_LINE = 64;
const CART_DAYS = 30;

/** Options for cookies().set(CART_COOKIE, ...): only the server reads it. */
export const CART_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: CART_DAYS * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
} as const;

export type CartLine = { listingId: string; units: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const lines = new Map<string, number>();
    for (const entry of value) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || !UUID.test(entry[0])) continue;
      const units = Number(entry[1]);
      if (!Number.isInteger(units) || units < 1) continue;
      const id = entry[0].toLowerCase();
      lines.set(id, Math.min(MAX_UNITS_PER_LINE, (lines.get(id) ?? 0) + units));
    }
    return [...lines].slice(0, CART_MAX_LINES).map(([listingId, units]) => ({ listingId, units }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.slice(0, CART_MAX_LINES).map((line) => [line.listingId, line.units]));
}

/** Adds units to a line (or creates it), capped at MAX_UNITS_PER_LINE. */
export function addToCart(lines: CartLine[], listingId: string, units: number): CartLine[] {
  const id = listingId.toLowerCase();
  const existing = lines.find((line) => line.listingId === id);
  if (existing) {
    return lines.map((line) =>
      line.listingId === id ? { ...line, units: Math.min(MAX_UNITS_PER_LINE, line.units + units) } : line,
    );
  }
  return [...lines, { listingId: id, units: Math.min(MAX_UNITS_PER_LINE, units) }].slice(0, CART_MAX_LINES);
}

/** Sets the units of a line; 0 or less removes it. */
export function setCartUnits(lines: CartLine[], listingId: string, units: number): CartLine[] {
  const id = listingId.toLowerCase();
  if (units <= 0) return lines.filter((line) => line.listingId !== id);
  return lines.map((line) => (line.listingId === id ? { ...line, units: Math.min(MAX_UNITS_PER_LINE, units) } : line));
}

/** Removes the given listings (e.g. after ordering them). */
export function removeFromCart(lines: CartLine[], listingIds: Iterable<string>): CartLine[] {
  const ids = new Set([...listingIds].map((id) => id.toLowerCase()));
  return lines.filter((line) => !ids.has(line.listingId));
}

export function cartUnits(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.units, 0);
}

/** Units from a form field: an integer between 1 and max (64 by default), else null. */
export function parseUnits(raw: unknown, max = MAX_UNITS_PER_LINE): number | null {
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw.trim())) return null;
  const units = Number(raw.trim());
  return units >= 1 && units <= Math.min(max, MAX_UNITS_PER_LINE) ? units : null;
}

/** Highest quantity that can be picked for a listing with this stock (0 when sold out). */
export function maxUnits(unitsAvailable: number): number {
  return Math.max(0, Math.min(MAX_UNITS_PER_LINE, Math.floor(unitsAvailable)));
}

/** "123.45" / "123.4" / "123" -> cents; anything else (negative, 3 decimals, junk) -> null. */
export function decimalToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
}

/** Line total in cents: exact, so it matches the database CHECK total = unit_price * quantity. */
export function lineTotalCents(unitPrice: number, units: number): number {
  return toCents(unitPrice) * units;
}

export type StockProblem = "unavailable" | "sold_out" | "not_enough_stock";

/** Why a line cannot be bought as is (null = fine). unitsAvailable null = not in the catalog. */
export function stockProblem(unitsAvailable: number | null | undefined, units: number): StockProblem | null {
  if (unitsAvailable == null) return "unavailable";
  if (unitsAvailable <= 0) return "sold_out";
  if (units > unitsAvailable) return "not_enough_stock";
  return null;
}

// Checkout

/** What the buyer reviewed and confirmed: listing, units and the unit price they saw. */
export type CheckoutRequestLine = { listingId: string; units: number; expectedPriceCents: number };

/** Fresh catalog data of a listing, plus the owner of its shop. */
export type CheckoutListing = {
  id: string;
  shopId: string;
  shopOwnerUuid: string | null;
  unitPrice: number;
  unitsAvailable: number;
};

export type CheckoutProblem =
  | { listingId: string; reason: "unavailable" }
  | { listingId: string; reason: "sold_out" }
  | { listingId: string; reason: "not_enough_stock"; available: number }
  | { listingId: string; reason: "own_shop" }
  | { listingId: string; reason: "price_changed"; unitPrice: number };

/** A validated order row, with decimal strings for the numeric columns. */
export type PricedLine = {
  listingId: string;
  shopId: string;
  quantity: number;
  unitPrice: string;
  total: string;
  totalCents: number;
};

export type CheckoutResult =
  | { ok: true; lines: PricedLine[]; totalCents: number }
  | { ok: false; problems: CheckoutProblem[] };

/**
 * Parses the checkout form fields (parallel lists of listingId, units and price).
 * Returns null if anything is malformed: wrong lengths, bad ids, units out of 1..64,
 * a repeated listing, more than CART_MAX_LINES lines or a bad price.
 */
export function parseCheckoutLines(ids: unknown[], units: unknown[], prices: unknown[]): CheckoutRequestLine[] | null {
  if (ids.length === 0 || ids.length > CART_MAX_LINES) return null;
  if (units.length !== ids.length || prices.length !== ids.length) return null;
  const seen = new Set<string>();
  const lines: CheckoutRequestLine[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (typeof id !== "string" || !UUID.test(id)) return null;
    const listingId = id.toLowerCase();
    if (seen.has(listingId)) return null;
    seen.add(listingId);
    const lineUnits = parseUnits(units[i]);
    const expectedPriceCents = decimalToCents(prices[i]);
    if (lineUnits === null || expectedPriceCents === null || expectedPriceCents <= 0) return null;
    lines.push({ listingId, units: lineUnits, expectedPriceCents });
  }
  return lines;
}

/**
 * Checks a checkout against fresh data and prices every line. A line fails when the listing
 * is no longer in the catalog, has less stock than requested, belongs to the buyer's own shop
 * or its price changed since the buyer reviewed it. All or nothing: any problem fails it all.
 * `allowOwnShop` lifts the own-shop rule (development only, see lib/dev-flags.ts).
 */
export function priceCheckout(
  request: CheckoutRequestLine[],
  listings: Map<string, CheckoutListing>,
  buyerUuid: string,
  { allowOwnShop = false }: { allowOwnShop?: boolean } = {},
): CheckoutResult {
  const problems: CheckoutProblem[] = [];
  const lines: PricedLine[] = [];
  let totalCents = 0;

  for (const line of request) {
    const listing = listings.get(line.listingId);
    if (!listing) {
      problems.push({ listingId: line.listingId, reason: "unavailable" });
      continue;
    }
    const ownShop =
      listing.shopOwnerUuid !== null && listing.shopOwnerUuid.toLowerCase() === buyerUuid.toLowerCase();
    if (ownShop && !allowOwnShop) {
      problems.push({ listingId: line.listingId, reason: "own_shop" });
      continue;
    }
    const stock = stockProblem(listing.unitsAvailable, line.units);
    if (stock === "not_enough_stock") {
      problems.push({ listingId: line.listingId, reason: stock, available: listing.unitsAvailable });
      continue;
    }
    if (stock) {
      problems.push({ listingId: line.listingId, reason: stock });
      continue;
    }
    const unitCents = toCents(listing.unitPrice);
    if (unitCents !== line.expectedPriceCents) {
      problems.push({ listingId: line.listingId, reason: "price_changed", unitPrice: listing.unitPrice });
      continue;
    }
    const lineCents = unitCents * line.units;
    totalCents += lineCents;
    lines.push({
      listingId: line.listingId,
      shopId: listing.shopId,
      quantity: line.units,
      unitPrice: centsToDecimal(unitCents),
      total: centsToDecimal(lineCents),
      totalCents: lineCents,
    });
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, lines, totalCents };
}
