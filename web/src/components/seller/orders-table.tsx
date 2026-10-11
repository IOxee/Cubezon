import { fmt, m, plural } from "@/i18n";
import type { SellerOrder } from "@/lib/data/seller";
import { formatAmount, formatDateTime, formatInteger, serialOf } from "@/lib/format";
import { DEFAULT_ORDERS_MODE, isProcessing, sellerPayout, type OrdersMode } from "@/lib/order-display";
import { ItemIcon } from "@/components/ui/item-icon";
import { OrderStatusStamp } from "@/components/ui/order-status";
import { Price } from "@/components/ui/price";

const columns = m.seller.orders.columns;
const payout = m.roleplay.panel.payout;

/**
 * Orders of the seller's shop: who bought what, where it is picked up, its status and when the
 * shop got the money. `mode` is the order mode of the plugin (roleplay changes some statuses).
 */
export function OrdersTable({
  orders,
  caption,
  mode = DEFAULT_ORDERS_MODE,
}: {
  orders: SellerOrder[];
  caption: string;
  mode?: OrdersMode;
}) {
  return (
    <div className="overflow-x-auto border-2 border-edge bg-surface">
      <table className="w-full min-w-[880px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-edge text-left">
            <th scope="col" className="label px-3 py-2">{columns.number}</th>
            <th scope="col" className="label px-3 py-2">{columns.date}</th>
            <th scope="col" className="label px-3 py-2">{columns.buyer}</th>
            <th scope="col" className="label px-3 py-2">{columns.listing}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.units}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.total}</th>
            <th scope="col" className="label px-3 py-2">{columns.locker}</th>
            <th scope="col" className="label px-3 py-2">{columns.status}</th>
            <th scope="col" className="label px-3 py-2">{payout.column}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-line last:border-b-0">
              <td className="num px-3 py-2 text-xs whitespace-nowrap text-ink-2">{serialOf(order.id)}</td>
              <td className="num px-3 py-2 text-xs whitespace-nowrap text-ink-2">{formatDateTime(order.createdAt)}</td>
              <td className="px-3 py-2 font-semibold">{order.buyerName ?? m.seller.orders.unknownBuyer}</td>
              <td className="px-3 py-2">
                {order.listing ? (
                  <span className="flex items-center gap-2">
                    <ItemIcon material={order.listing.material} size={24} />
                    <span className="line-clamp-1">{order.listing.title}</span>
                  </span>
                ) : (
                  m.common.none
                )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <span className="num font-semibold">{formatInteger(order.quantity)}</span>
                {order.listing && order.listing.unitAmount > 1 ? (
                  <span className="block text-xs text-ink-3">
                    {plural(order.quantity * order.listing.unitAmount, m.seller.orders.items)}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right">
                <Price amount={order.total} size="sm" />
                {order.expressFee > 0 ? (
                  <span className="num block text-xs text-ink-3">
                    {fmt(m.seller.orders.expressExtra, { amount: formatAmount(order.expressFee) })}
                  </span>
                ) : null}
                {order.tip > 0 ? (
                  <span className="num block text-xs text-ink-3">
                    {fmt(m.seller.orders.tipExtra, { amount: formatAmount(order.tip) })}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {order.delivery === "MAILBOX" ? m.seller.orders.mailbox : (order.lockerName ?? m.common.none)}
              </td>
              <td className="px-3 py-2">
                <OrderStatusStamp
                  status={order.status}
                  processing={isProcessing(order)}
                  mode={mode}
                  failureReason={order.failureReason}
                  delivery={order.delivery}
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <PayoutCell order={order} mode={mode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** «Cobrado» column: the payout date, or why there is none yet. */
function PayoutCell({ order, mode }: { order: SellerOrder; mode: OrdersMode }) {
  const state = sellerPayout(order);
  if (state === "paid" && order.sellerPaidAt) {
    return <span className="num text-xs text-success">{formatDateTime(order.sellerPaidAt)}</span>;
  }
  if (state === "pending") {
    // In roleplay the money is held from acceptance (PAID) until the package reaches the locker.
    const text = mode === "roleplay" && order.status === "PAID" ? payout.pendingDelivery : payout.pending;
    return <span className="text-xs text-ink-2">{text}</span>;
  }
  return <span className="text-ink-3">{payout.none}</span>;
}
