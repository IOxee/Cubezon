import { decimalToCents } from "@/lib/cart";
import { leadLineByShop, type ChargeLine } from "@/lib/delivery";

/**
 * Optional tips at checkout (orders.tip). The plugin publishes whether they are on and the
 * highest tip per order (plugin_settings tips_enabled, tips_max); it charges the tip with the
 * order and pays it to the employee who delivers it, or to the shop without one. The buyer tips
 * each shop of the cart once: the tip goes on that shop's most expensive line. Pure.
 */

export type TipSettings = { enabled: boolean; maxCents: number };

/** On only with 'true' and a valid cap above 0 (a cap of 0 leaves nothing to give). */
export function parseTipSettings(enabled: unknown, max: unknown): TipSettings {
  const maxCents = typeof max === "string" ? decimalToCents(max) : null;
  return {
    enabled:
      typeof enabled === "string" && enabled.trim().toLowerCase() === "true" && maxCents !== null && maxCents > 0,
    maxCents: maxCents ?? 0,
  };
}

export type TipInputResult = { ok: true; cents: number } | { ok: false; error: "format" | "range" | "off" };

/**
 * What the buyer typed for one shop: empty is no tip; "12,5" or "12.50" (at most 2 decimals),
 * from 0 to the cap. Any tip while tips are off is refused ("off"), so a stale page cannot add one.
 */
export function parseTipInput(raw: unknown, settings: TipSettings): TipInputResult {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return { ok: true, cents: 0 };
  const cents = decimalToCents(text.replace(",", "."));
  if (cents === null) return { ok: false, error: "format" };
  if (cents === 0) return { ok: true, cents: 0 };
  if (!settings.enabled) return { ok: false, error: "off" };
  return cents > settings.maxCents ? { ok: false, error: "range" } : { ok: true, cents };
}

/**
 * The tip of each line: each shop's tip (cents per shop id, missing = 0) on its most expensive
 * line, the rest 0. Every line is its own order, and the cap applies per order.
 */
export function tipsByLine(lines: readonly ChargeLine[], tipsByShop: ReadonlyMap<string, number>): number[] {
  const leads = leadLineByShop(lines);
  return lines.map((line, index) => (leads.get(line.shopId) === index ? (tipsByShop.get(line.shopId) ?? 0) : 0));
}

/** Form field of the tip for one shop of the checkout. */
export function tipFieldName(shopId: string): string {
  return `tip-${shopId}`;
}
