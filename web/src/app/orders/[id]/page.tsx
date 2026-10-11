import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { requirePlayer } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/catalog";
import { FINAL_STATUSES, getMyOrder, type OrderDetail, type OrderStatus } from "@/lib/data/orders";
import { getOrdersMode } from "@/lib/data/roleplay";
import { formatDateTime, formatMoney, serialOf } from "@/lib/format";
import { CommandText } from "@/components/shopping/command-text";
import { LineItemInfo } from "@/components/shopping/line-item";
import { Ticket, TicketHeader, TicketRow, TicketRule } from "@/components/shopping/ticket";
import { worldName } from "@/components/shopping/world-name";
import { Notice } from "@/components/ui/notice";
import { OrderStatusStamp } from "@/components/ui/order-status";
import {
  failureReasonText,
  isCancelled,
  isProcessing,
  orderStatusHelp,
  orderStatusLabel,
  orderStepLabel,
  type OrdersMode,
} from "@/lib/order-display";
import { Price } from "@/components/ui/price";
import { AutoRefresh } from "./_components/auto-refresh";
import { ReviewForm } from "./_components/review-form";

export const metadata: Metadata = { title: m.account.order.metaTitle };

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/orders" className="link self-start text-sm">
        ← {m.account.order.back}
      </Link>
      <Suspense fallback={<OrderSkeleton />}>
        <Order params={props.params} />
      </Suspense>
    </div>
  );
}

async function Order({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const player = await requirePlayer(`/orders/${id}`);
  const [order, mode] = await Promise.all([getMyOrder(player, id.toLowerCase()), getOrdersMode()]);
  if (!order) notFound();

  const t = m.account.order;
  const serial = serialOf(order.id);
  const live = !FINAL_STATUSES.includes(order.status);
  const processing = isProcessing(order);
  const cancelled = isCancelled(order);
  const statusOptions = { processing, mode, failureReason: order.failureReason, delivery: order.delivery };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-edge pb-4">
        <div>
          <p className="label">{t.label}</p>
          <h1 className="text-2xl">{fmt(t.title, { serial })}</h1>
          <p className="num text-sm text-ink-3">{formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusStamp
          status={order.status}
          processing={processing}
          mode={mode}
          failureReason={order.failureReason}
          delivery={order.delivery}
          size="lg"
        />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Notice tone={order.status === "FAILED" && !cancelled ? "danger" : order.status === "READY" ? "success" : "info"}>
            <p className="font-semibold">{orderStatusLabel(order.status, statusOptions)}</p>
            <p className="mt-1">
              <CommandText template={orderStatusHelp(order.status, statusOptions)} command={m.commands.pickup} />
            </p>
            {order.failureReason ? <p className="mt-1">{failureReasonText(order.failureReason)}</p> : null}
          </Notice>

          <section aria-labelledby="tracking-title" className="card p-4">
            <h2 id="tracking-title" className="mb-4 text-xl">
              {t.trackingTitle}
            </h2>
            <Tracking order={order} mode={mode} />
            {live ? (
              <>
                {/* In roleplay mode a shop may take hours to accept or deliver: poll less often. */}
                <AutoRefresh intervalMs={mode === "roleplay" && !processing ? 60_000 : undefined} />
                <p className="mt-4 text-xs text-ink-3">{t.autoRefresh}</p>
              </>
            ) : null}
          </section>

          {order.delivery === "MAILBOX" ? (
            <section aria-labelledby="pickup-title" className="card flex flex-col gap-3 p-4">
              <h2 id="pickup-title" className="text-xl">
                {t.mailboxTitle}
              </h2>
              {order.mailbox ? <Place world={order.mailbox.world} x={order.mailbox.x} y={order.mailbox.y} z={order.mailbox.z} /> : null}
              <p className="text-sm text-ink-2">
                <CommandText template={t.mailboxHow} command={m.commands.mailbox} />
              </p>
              {order.mailbox ? null : <Notice tone="danger">{t.mailboxGone}</Notice>}
            </section>
          ) : order.locker ? (
            <section aria-labelledby="pickup-title" className="card flex flex-col gap-3 p-4">
              <h2 id="pickup-title" className="text-xl">
                {t.pickupTitle}
              </h2>
              <p className="text-lg font-semibold">{order.locker.name}</p>
              <Place world={order.locker.world} x={order.locker.x} y={order.locker.y} z={order.locker.z} />
              <p className="text-sm text-ink-2">
                <CommandText template={t.pickupHow} command={m.commands.pickup} />
              </p>
              {!order.locker.active ? <Notice tone="danger">{t.lockerInactive}</Notice> : null}
              <Link href="/lockers" className="link self-start text-sm">
                {t.lockersLink}
              </Link>
            </section>
          ) : null}

          {order.status === "COLLECTED" ? (
            <section aria-labelledby="review-title" className="card flex flex-col gap-3 p-4">
              <h2 id="review-title" className="text-xl">
                {t.review.title}
              </h2>
              <p className="text-sm text-ink-2">{order.review ? t.review.existing : t.review.intro}</p>
              <ReviewForm orderId={order.id} existing={order.review} />
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Receipt order={order} serial={serial} mode={mode} />
          <div className="card-soft p-3">
            <LineItemInfo listing={{ ...order.listing, shop: order.shop }} iconSize={40} />
          </div>
        </aside>
      </div>
    </div>
  );
}

type Step = { status: OrderStatus; at: string | null; note: string | null; state: "done" | "current" | "todo" | "failed" };

const FLOW: OrderStatus[] = ["PENDING", "PAID", "READY", "COLLECTED"];

/** Steps of the order: the happy path, or what actually happened when it failed. */
function trackingSteps(order: OrderDetail): Step[] {
  const fallback: Partial<Record<OrderStatus, string | null>> = {
    PENDING: order.createdAt,
    PAID: order.paidAt,
    READY: order.readyAt,
    COLLECTED: order.collectedAt,
  };
  const eventOf = (status: OrderStatus) => order.events.find((event) => event.status === status);
  const at = (status: OrderStatus) => eventOf(status)?.at ?? fallback[status] ?? null;

  if (order.status === "FAILED" || order.status === "REFUNDED") {
    const statuses: OrderStatus[] = ["PENDING"];
    for (const event of order.events) if (!statuses.includes(event.status)) statuses.push(event.status);
    if (!statuses.includes(order.status)) statuses.push(order.status);
    // The trigger copies failure_reason into every later event: show it once.
    const reasonOn: OrderStatus = statuses.includes("FAILED") ? "FAILED" : "REFUNDED";
    return statuses.map((status) => ({
      status,
      at: at(status),
      note: status === reasonOn ? (eventOf(status)?.note ?? order.failureReason) : null,
      state: status === "FAILED" && !isCancelled(order) ? "failed" : "done",
    }));
  }

  const reached = FLOW.indexOf(order.status);
  return FLOW.map((status, index) => ({
    status,
    at: index <= reached ? at(status) : null,
    note: null,
    state: index < reached || (index === reached && status === "COLLECTED") ? "done" : index === reached ? "current" : "todo",
  }));
}

const MARKER = {
  done: "bg-ink border-edge",
  current: "bg-accent border-edge",
  todo: "bg-surface border-line",
  failed: "bg-danger border-danger",
} as const;

function Tracking({ order, mode }: { order: OrderDetail; mode: OrdersMode }) {
  const t = m.account.order;
  const steps = trackingSteps(order);
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={`absolute top-5 bottom-0 left-[7px] w-0.5 ${step.state === "done" ? "bg-ink" : "bg-line"}`}
            />
          ) : null}
          <span aria-hidden className={`relative mt-0.5 size-4 shrink-0 border-2 ${MARKER[step.state]}`} />
          <div className="flex min-w-0 flex-col">
            <span
              className={`font-semibold ${step.state === "todo" ? "text-ink-3" : ""} ${step.state === "failed" ? "text-danger" : ""}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {orderStepLabel(step.status, mode, order.failureReason, order.delivery)}
            </span>
            <span className="num text-xs text-ink-3">{step.at ? formatDateTime(step.at) : t.stepWaiting}</span>
            {step.note ? (
              <span className="text-sm text-ink-2">{fmt(t.failureReason, { reason: failureReasonText(step.note) ?? step.note })}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

const RECEIPT_STATUS: Record<OrderStatus, "pending" | "paid" | "failed" | "refunded"> = {
  PENDING: "pending",
  PAID: "paid",
  READY: "paid",
  COLLECTED: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
};

/** Barcode drawn from the order id (decorative, but stable per order). */
function Barcode({ id, serial }: { id: string; serial: string }) {
  const digits = id.replace(/-/g, "").split("").map((char) => parseInt(char, 16));
  return (
    <div role="img" aria-label={fmt(m.a11y.barcode, { code: serial })} className="flex h-10 items-stretch justify-center gap-px">
      {digits.map((value, index) => (
        <span key={index} className="flex gap-px">
          <span className="bg-ink" style={{ width: 1 + (value % 3) }} />
          <span style={{ width: 1 + ((value >> 2) % 2) }} />
        </span>
      ))}
    </div>
  );
}

function Receipt({ order, serial, mode }: { order: OrderDetail; serial: string; mode: OrdersMode }) {
  const r = m.account.order.receipt;
  const status = isCancelled(order) ? "cancelled" : RECEIPT_STATUS[order.status];
  return (
    <Ticket label={r.title}>
      <TicketHeader title={r.header} subtitle={r.subheader} />
      <TicketRule />
      <TicketRow label={r.number} value={serial} muted />
      <TicketRow label={r.date} value={formatDateTime(order.createdAt)} muted />
      <TicketRow label={r.shop} value={<span className="font-sans">{order.shop.name}</span>} muted />
      {order.delivery === "MAILBOX" ? (
        <TicketRow label={r.delivery} value={<span className="font-sans">{r.deliveryMailbox}</span>} muted />
      ) : (
        <TicketRow label={r.locker} value={<span className="font-sans">{order.locker?.name ?? m.common.none}</span>} muted />
      )}
      <TicketRule />
      <p className="font-semibold">{order.listing.title}</p>
      {order.listing.unitAmount > 1 ? (
        <p className="text-xs text-ink-2">{plural(order.listing.unitAmount, r.perUnit)}</p>
      ) : null}
      <TicketRow
        label={fmt(r.line, { units: order.quantity, price: formatMoney(order.unitPrice) })}
        value={formatMoney(order.total)}
      />
      {order.expressFee > 0 ? <TicketRow label={r.express} value={formatMoney(order.expressFee)} /> : null}
      {order.tip > 0 ? <TicketRow label={r.tip} value={formatMoney(order.tip)} /> : null}
      <TicketRule />
      <TicketRow label={r.total} value={<Price amount={order.total + order.expressFee + order.tip} size="md" />} strong />
      <p className="text-xs text-ink-2">
        {mode === "roleplay" && status === "pending" ? m.roleplay.status.receiptPending : r[status]}
      </p>
      <TicketRule />
      <Barcode id={order.id} serial={serial} />
      <p className="text-center text-xs text-ink-3">{r.footer}</p>
    </Ticket>
  );
}

/** World and coordinates of a locker or a mailbox. */
function Place({ world, x, y, z }: { world: string; x: number; y: number; z: number }) {
  const t = m.account.order;
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:max-w-sm">
      <div>
        <dt className="label">{t.world}</dt>
        <dd>{worldName(world)}</dd>
      </div>
      <div>
        <dt className="label">{t.coords}</dt>
        <dd className="num">
          {x}, {y}, {z}
        </dd>
      </div>
    </dl>
  );
}

function OrderSkeleton() {
  return (
    <div role="status" aria-label={m.a11y.loading} className="flex flex-col gap-6">
      <div className="skeleton h-20" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <div className="skeleton h-16" />
          <div className="skeleton h-56" />
          <div className="skeleton h-40" />
        </div>
        <div className="skeleton h-96" />
      </div>
    </div>
  );
}
