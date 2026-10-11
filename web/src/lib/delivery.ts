import { decimalToCents } from "@/lib/cart";

/**
 * How an order reaches the buyer (orders.delivery_method): a locker they pick up from, or express
 * delivery to their own mailbox (placed in the game) for an extra fee. The plugin publishes
 * whether express is on, its fee and who sets it in plugin_settings (express_enabled,
 * express_fee, express_pricing, express_max_fee). Pure.
 */

export type DeliveryMethod = "LOCKER" | "MAILBOX";

export function parseDeliveryMethod(value: unknown): DeliveryMethod {
  return value === "MAILBOX" ? "MAILBOX" : "LOCKER";
}

/**
 * Who sets the express fee (plugin ExpressPricing): `server`, the same fee for every shop;
 * `shop`, each shop its own (shops.express_fee, the server's while it has none); `shop-capped`,
 * the same but never above the server's cap.
 */
export const EXPRESS_PRICINGS = ["server", "shop", "shop-capped"] as const;
export type ExpressPricing = (typeof EXPRESS_PRICINGS)[number];

export type ExpressSettings = {
  enabled: boolean;
  /** The server's fee: everyone's in `server` mode, the default of shops without their own. */
  feeCents: number;
  pricing: ExpressPricing;
  /** Highest fee a shop may charge in `shop-capped` mode. */
  maxFeeCents: number;
};

/** Highest fee a shop may type when there is no cap (same limit as the feature panel). */
export const SHOP_EXPRESS_FEE_MAX_CENTS = 100_000_000_000;

/** A plugin_settings decimal ("100.00", "2.5") in cents, or null when missing or malformed. */
function settingCents(value: unknown): number | null {
  return typeof value === "string" ? decimalToCents(value) : null;
}

export function parseExpressPricing(value: unknown): ExpressPricing {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EXPRESS_PRICINGS.find((pricing) => pricing === text) ?? "server";
}

/**
 * plugin_settings values: on only with 'true' and a valid, non-negative fee. Unknown pricing is
 * `server`; a missing cap falls back to the server's fee (old plugins never publish it).
 */
export function parseExpressSettings(enabled: unknown, fee: unknown, pricing?: unknown, maxFee?: unknown): ExpressSettings {
  const feeCents = settingCents(fee);
  return {
    enabled: typeof enabled === "string" && enabled.trim().toLowerCase() === "true" && feeCents !== null,
    feeCents: feeCents ?? 0,
    pricing: parseExpressPricing(pricing),
    maxFeeCents: settingCents(maxFee) ?? feeCents ?? 0,
  };
}

/** Whether each shop sets its own express fee (and charges it once per purchase). */
export function shopsSetExpressFee(settings: ExpressSettings): boolean {
  return settings.pricing !== "server";
}

/** The fee a shop's express orders pay (plugin ExpressPricing.feeFor). `shopFeeCents`: shops.express_fee. */
export function shopExpressFeeCents(settings: ExpressSettings, shopFeeCents: number | null): number {
  const fee = settings.pricing === "server" || shopFeeCents === null ? settings.feeCents : shopFeeCents;
  return settings.pricing === "shop-capped" ? Math.min(fee, settings.maxFeeCents) : fee;
}

/** What the per-line distributions need from a checkout line. */
export type ChargeLine = { shopId: string; totalCents: number };

/** Index of the most expensive line (the first one on ties) among `indexes`. */
function mostExpensive(lines: readonly ChargeLine[], indexes: readonly number[]): number {
  return indexes.reduce((best, index) => (lines[index].totalCents > lines[best].totalCents ? index : best));
}

/**
 * The line of each shop that carries the charges paid once per shop (express fee, tip): its most
 * expensive one, the least likely to be rejected; the first one on ties.
 */
export function leadLineByShop(lines: readonly ChargeLine[]): Map<string, number> {
  const byShop = new Map<string, number[]>();
  lines.forEach((line, index) => byShop.set(line.shopId, [...(byShop.get(line.shopId) ?? []), index]));
  return new Map([...byShop].map(([shopId, indexes]) => [shopId, mostExpensive(lines, indexes)]));
}

/**
 * The express fee of each line (every cart line is its own order; the plugin charges total +
 * express_fee + tip of each). `server` pricing: the fee once per purchase, on the most expensive
 * line. Per-shop pricing: each shop charges its fee once per purchase, on its own most expensive
 * line. `shopFees`: shops.express_fee per shop id (missing = none).
 */
export function expressFeesByLine(
  lines: readonly ChargeLine[],
  settings: ExpressSettings,
  shopFees: ReadonlyMap<string, number | null> = new Map(),
): number[] {
  if (lines.length === 0) return [];
  if (!shopsSetExpressFee(settings)) {
    const target = mostExpensive(lines, lines.map((_, index) => index));
    return lines.map((_, index) => (index === target ? settings.feeCents : 0));
  }
  const leads = leadLineByShop(lines);
  return lines.map((line, index) =>
    leads.get(line.shopId) === index ? shopExpressFeeCents(settings, shopFees.get(line.shopId) ?? null) : 0,
  );
}

export type ShopExpressFeeResult =
  | { ok: true; cents: number | null }
  | { ok: false; error: "expressFeeLocked" | "expressFeeFormat" | "expressFeeRange" };

/**
 * The express fee a shop types in its panel: empty = the server's (null). Only when shops set
 * their fee; 0 or more, at most 2 decimals, and never above the cap in `shop-capped` mode.
 */
export function validateShopExpressFee(settings: ExpressSettings, input: unknown): ShopExpressFeeResult {
  if (!shopsSetExpressFee(settings)) return { ok: false, error: "expressFeeLocked" };
  const text = typeof input === "string" ? input.trim() : "";
  if (text === "") return { ok: true, cents: null };
  const cents = decimalToCents(text.replace(",", "."));
  if (cents === null) return { ok: false, error: "expressFeeFormat" };
  return cents > shopExpressFeeMaxCents(settings) ? { ok: false, error: "expressFeeRange" } : { ok: true, cents };
}

/** Highest fee a shop may set: the cap in `shop-capped` mode. */
export function shopExpressFeeMaxCents(settings: ExpressSettings): number {
  return settings.pricing === "shop-capped" ? settings.maxFeeCents : SHOP_EXPRESS_FEE_MAX_CENTS;
}
