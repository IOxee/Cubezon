import type { DeliveryMethod } from "@/lib/delivery";
import { DEFAULT_ORDERS_MODE, isCancelled, orderStampLabel, type OrderStatus, type OrdersMode } from "@/lib/order-display";
import { Stamp } from "./stamp";

export type { OrderStatus } from "@/lib/order-display";

const TONE = {
  PENDING: "muted",
  PAID: "ink",
  READY: "success",
  COLLECTED: "success",
  FAILED: "danger",
  REFUNDED: "muted",
} as const;

/**
 * Order status as a crooked stamp ("EN TAQUILLA", "RECOGIDO"…). `processing` marks a PENDING
 * order that the plugin has already claimed (orders.processing_started_at). `mode` is the order
 * mode of the plugin: in "roleplay" PENDING and PAID read "POR ACEPTAR" and "EN PREPARACIÓN".
 * `failureReason` turns a FAILED order the shop rejected (or that expired) into "CANCELADO".
 */
export function OrderStatusStamp({
  status,
  processing = false,
  size = "sm",
  mode = DEFAULT_ORDERS_MODE,
  failureReason = null,
  delivery = "LOCKER",
}: {
  status: OrderStatus;
  processing?: boolean;
  size?: "sm" | "md" | "lg";
  mode?: OrdersMode;
  failureReason?: string | null;
  /** Express orders read "EN TU BUZÓN" instead of "EN TAQUILLA". */
  delivery?: DeliveryMethod;
}) {
  const tone =
    status === "PENDING" && processing ? "ink" : isCancelled({ status, failureReason }) ? "muted" : TONE[status];
  return (
    <Stamp tone={tone} size={size} rotate={status === "COLLECTED" ? -6 : -3}>
      {orderStampLabel(status, { processing, mode, failureReason, delivery })}
    </Stamp>
  );
}
