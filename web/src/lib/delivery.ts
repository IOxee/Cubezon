import { toCents } from "@/lib/format";

/**
 * How an order reaches the buyer (orders.delivery_method): a locker they pick up from, or express
 * delivery to their own mailbox (placed in the game) for an extra fee. The plugin publishes
 * whether express is on and its fee in plugin_settings (express_enabled, express_fee). Pure.
 */

export type DeliveryMethod = "LOCKER" | "MAILBOX";

export function parseDeliveryMethod(value: unknown): DeliveryMethod {
  return value === "MAILBOX" ? "MAILBOX" : "LOCKER";
}

export type ExpressSettings = { enabled: boolean; feeCents: number };

/** plugin_settings values: on only with 'true' and a valid, non-negative fee ("100.00"). */
export function parseExpressSettings(enabled: unknown, fee: unknown): ExpressSettings {
  const text = typeof fee === "string" ? fee.trim() : "";
  const valid = /^\d{1,12}(\.\d{1,2})?$/.test(text);
  const feeCents = valid ? toCents(Number(text)) : 0;
  return {
    enabled: typeof enabled === "string" && enabled.trim().toLowerCase() === "true" && valid,
    feeCents,
  };
}

/**
 * The express fee is charged once per purchase, although every cart line is its own order: it
 * goes on the most expensive line (the least likely to be rejected; the first one on ties) and
 * the rest get 0. The plugin charges total + express_fee of each order.
 */
export function expressFeeByLine(lineTotalsCents: readonly number[], feeCents: number): number[] {
  if (lineTotalsCents.length === 0) return [];
  let target = 0;
  lineTotalsCents.forEach((total, index) => {
    if (total > lineTotalsCents[target]) target = index;
  });
  return lineTotalsCents.map((_, index) => (index === target ? feeCents : 0));
}
