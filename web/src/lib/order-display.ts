import { fmt, m } from "@/i18n";
import type { DeliveryMethod } from "@/lib/delivery";

/**
 * How orders are shown to buyers and sellers. Pure (no server code): the order mode comes from
 * getOrdersMode() in lib/data/roleplay.ts and is passed in; "automatic" keeps the usual texts.
 */

export type OrderStatus = "PENDING" | "PAID" | "READY" | "COLLECTED" | "FAILED" | "REFUNDED";

/**
 * Order mode of the plugin (plugin_settings.orders_mode): "automatic" (the plugin charges and
 * prepares the orders by itself) or "roleplay" (each shop accepts and delivers its orders by hand
 * from its company computer in the game).
 */
export type OrdersMode = "automatic" | "roleplay";

export const DEFAULT_ORDERS_MODE: OrdersMode = "automatic";

/** Value of plugin_settings.orders_mode; anything unknown (or no row) is "automatic". */
export function parseOrdersMode(value: unknown): OrdersMode {
  return typeof value === "string" && value.trim().toLowerCase() === "roleplay" ? "roleplay" : DEFAULT_ORDERS_MODE;
}

/** A PENDING order with processing_started_at set is being charged by the plugin right now. */
export function isProcessing(order: { status: string; processingStartedAt?: string | null }): boolean {
  return order.status === "PENDING" && Boolean(order.processingStartedAt);
}

/**
 * failure_reason codes that are not errors but a decision: the shop rejected the order, or nobody
 * accepted it in time (roleplay). Nothing was charged; they read "Cancelado" instead of "Fallido".
 */
export const CANCELLED_REASONS: readonly string[] = ["SHOP_REJECTED", "EXPIRED"];

/** A FAILED order that was cancelled (see CANCELLED_REASONS), not one that went wrong. */
export function isCancelled(order: { status: string; failureReason?: string | null }): boolean {
  return order.status === "FAILED" && CANCELLED_REASONS.includes(order.failureReason ?? "");
}

type StatusOptions = { processing?: boolean; mode?: OrdersMode; failureReason?: string | null; delivery?: DeliveryMethod };

type MailboxTexts = { order: Partial<Record<OrderStatus, string>>; stamp: Partial<Record<OrderStatus, string>>; help: Partial<Record<OrderStatus, string>>; steps: Partial<Record<OrderStatus, string>> };

/** Texts of express orders (they reach the buyer's mailbox), or null for locker orders. */
function mailboxTexts(delivery: DeliveryMethod | undefined): MailboxTexts | null {
  return delivery === "MAILBOX" ? m.status.mailbox : null;
}

/** Statuses whose texts change in roleplay mode (waiting for the shop / being prepared). */
type RoleplayStatus = keyof typeof m.roleplay.status.order;

function roleplayStatus(status: OrderStatus, mode: OrdersMode): RoleplayStatus | null {
  return mode === "roleplay" && status in m.roleplay.status.order ? (status as RoleplayStatus) : null;
}

/** Name of the status: "Pendiente de cobro", or "Esperando a la tienda" in roleplay mode. */
export function orderStatusLabel(
  status: OrderStatus,
  { processing = false, mode = DEFAULT_ORDERS_MODE, failureReason, delivery }: StatusOptions = {},
): string {
  if (status === "PENDING" && processing) return m.status.processing;
  if (isCancelled({ status, failureReason })) return m.status.cancelled.order;
  const mailbox = mailboxTexts(delivery)?.order[status];
  if (mailbox) return mailbox;
  const roleplay = roleplayStatus(status, mode);
  return roleplay ? m.roleplay.status.order[roleplay] : m.status.order[status];
}

/** Text of the status stamp ("Pendiente", "Por aceptar", "En taquilla", "Cancelado"…). */
export function orderStampLabel(
  status: OrderStatus,
  { processing = false, mode = DEFAULT_ORDERS_MODE, failureReason, delivery }: StatusOptions = {},
): string {
  if (status === "PENDING" && processing) return m.status.processingStamp;
  if (isCancelled({ status, failureReason })) return m.status.cancelled.stamp;
  const mailbox = mailboxTexts(delivery)?.stamp[status];
  if (mailbox) return mailbox;
  const roleplay = roleplayStatus(status, mode);
  return roleplay ? m.roleplay.status.stamp[roleplay] : m.status.orderStamp[status];
}

/** What the status means for the buyer. May contain a {command} placeholder (READY). */
export function orderStatusHelp(
  status: OrderStatus,
  { processing = false, mode = DEFAULT_ORDERS_MODE, failureReason, delivery }: StatusOptions = {},
): string {
  if (status === "PENDING" && processing) {
    return mode === "roleplay" ? m.roleplay.status.processingHelp : m.status.processingHelp;
  }
  if (isCancelled({ status, failureReason })) return m.status.cancelled.help;
  const mailbox = mailboxTexts(delivery)?.help[status];
  if (mailbox) return mailbox;
  const roleplay = roleplayStatus(status, mode);
  return roleplay ? m.roleplay.status.help[roleplay] : m.status.orderHelp[status];
}

/** Name of a step in the tracking of the order page ("Cobrado" / "Aceptado y cobrado"…). */
export function orderStepLabel(
  status: OrderStatus,
  mode: OrdersMode = DEFAULT_ORDERS_MODE,
  failureReason?: string | null,
  delivery?: DeliveryMethod,
): string {
  if (isCancelled({ status, failureReason })) return m.status.cancelled.order;
  const mailbox = mailboxTexts(delivery)?.steps[status];
  if (mailbox) return mailbox;
  const steps: Partial<Record<OrderStatus, string>> = m.roleplay.status.steps;
  return (mode === "roleplay" ? steps[status] : undefined) ?? m.account.order.steps[status];
}

const REASONS: Record<string, string> = { ...m.status.failureReason, ...m.roleplay.failureReason };

/** Text for orders.failure_reason (a code set by the plugin); unknown codes are shown as they are. */
export function failureReasonText(code: string | null | undefined): string | null {
  if (!code) return null;
  return REASONS[code] ?? fmt(m.status.failureReasonUnknown, { code });
}

/**
 * Whether the seller got the money of an order (orders.seller_paid_at): "paid" once it is set;
 * "pending" while the order is sold but not paid out yet (in roleplay the money is held until
 * the package reaches the locker, and a failed payout is retried); "none" when nothing is due.
 */
export type SellerPayout = "paid" | "pending" | "none";

const PAYOUT_DUE: readonly OrderStatus[] = ["PAID", "READY", "COLLECTED"];

export function sellerPayout(order: { status: OrderStatus; sellerPaidAt: string | null }): SellerPayout {
  if (order.sellerPaidAt) return "paid";
  return PAYOUT_DUE.includes(order.status) ? "pending" : "none";
}
