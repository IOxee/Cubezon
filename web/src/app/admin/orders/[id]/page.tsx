import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DataTable, td, th } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TilesSkeleton } from "@/components/admin/skeletons";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { OrderStatusStamp } from "@/components/ui/order-status";
import { failureReasonText, isProcessing, orderStatusLabel } from "@/lib/order-display";
import { Price } from "@/components/ui/price";
import { ShopSeal } from "@/components/ui/shop-mark";
import { fmt, m, plural } from "@/i18n";
import { itemName } from "@/i18n/items.es";
import { requireStaff } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/data/admin";
import { isUuid } from "@/lib/data/catalog";
import { formatDateTime, serialOf } from "@/lib/format";
import { inkStyle } from "@/lib/inks";

export const metadata: Metadata = { title: m.admin.order.title };

const t = m.admin.order;

export default function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  return (
    <>
      <Link href="/admin/orders" className="link mb-3 inline-block text-sm font-semibold">
        {t.back}
      </Link>
      <Suspense fallback={<TilesSkeleton />}>
        <OrderDetail params={props.params} />
      </Suspense>
    </>
  );
}

function worldName(world: string): string {
  return (m.worlds as Record<string, string>)[world] ?? world;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-soft grid content-start gap-2 p-4">
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const dates: [string, string | null][] = [
    [t.created, order.createdAt],
    [t.paid, order.paidAt],
    [t.ready, order.readyAt],
    [t.collected, order.collectedAt],
    [t.updated, order.updatedAt],
  ];

  return (
    <>
      <AdminPageHeader title={fmt(t.heading, { serial: serialOf(order.id) })} intro={t.readOnly}>
        <OrderStatusStamp
          status={order.status}
          processing={isProcessing(order)}
          failureReason={order.failureReason}
          delivery={order.delivery}
          size="md"
        />
      </AdminPageHeader>

      {order.failureReason ? (
        <Notice tone="danger" className="mb-4">
          <span className="label text-danger">{t.failure}</span>
          <p className="mt-1 whitespace-pre-line">{failureReasonText(order.failureReason)}</p>
          <p className="num mt-1 text-xs">{order.failureReason}</p>
        </Notice>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel title={t.buyer}>
          <p className="text-lg font-semibold">{order.buyer.name}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <Field label={t.uuid}>
              <span className="num text-xs">{order.buyer.uuid}</span>
            </Field>
          </dl>
        </Panel>

        <Panel title={t.shop}>
          {order.shop ? (
            <div className="flex items-center gap-3" style={inkStyle(order.shop.ink)}>
              <ShopSeal name={order.shop.name} ink={order.shop.ink} size={40} />
              <div className="min-w-0">
                <p className="font-semibold text-shop">{order.shop.name}</p>
                <p className="text-sm text-ink-2">
                  {t.shopStatus}: {m.status.shop[order.shop.status]}
                </p>
                {order.shop.status === "APPROVED" ? (
                  <Link href={`/t/${order.shop.slug}`} className="link text-sm">
                    {t.viewShop}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-ink-3">{m.common.none}</p>
          )}
        </Panel>

        <Panel title={t.listing}>
          {order.listing ? (
            <div className="flex items-start gap-3">
              <span className="squares shrink-0 p-1.5">
                <ItemIcon material={order.listing.material} size={40} alt={itemName(order.listing.material)} />
              </span>
              <div className="min-w-0 text-sm">
                <p className="text-base font-semibold">{order.listing.title}</p>
                <p className="text-ink-2">
                  {itemName(order.listing.material)} · {plural(order.listing.unitAmount, t.unitContent)}
                </p>
                <p className="text-ink-2">
                  {t.listingStatus}: {m.status.listing[order.listing.status]}
                </p>
                <Link href={`/p/${order.listing.id}`} className="link">
                  {t.viewListing}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-ink-3">{m.common.none}</p>
          )}
        </Panel>

        <Panel title={order.delivery === "MAILBOX" ? t.delivery : t.locker}>
          {order.delivery === "MAILBOX" ? (
            <>
              <p className="font-semibold">{t.mailbox}</p>
              {order.mailbox ? (
                <p className="num text-sm text-ink-2">
                  {fmt(t.coords, {
                    world: worldName(order.mailbox.world),
                    x: order.mailbox.x,
                    y: order.mailbox.y,
                    z: order.mailbox.z,
                  })}
                </p>
              ) : (
                <p className="text-sm text-ink-3">{t.mailboxGone}</p>
              )}
            </>
          ) : order.locker ? (
            <>
              <p className="flex items-center gap-2 font-semibold">
                {order.locker.name}
                {order.locker.active ? null : <span className="badge badge-paper">{t.inactiveLocker}</span>}
              </p>
              <p className="num text-sm text-ink-2">
                {fmt(t.coords, {
                  world: worldName(order.locker.world),
                  x: order.locker.x,
                  y: order.locker.y,
                  z: order.locker.z,
                })}
              </p>
            </>
          ) : (
            <p className="text-ink-3">{m.common.none}</p>
          )}
        </Panel>

        <Panel title={t.amounts}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-2">{t.unitPrice}</dt>
            <dd className="text-right">
              <Price amount={order.unitPrice} size="sm" />
            </dd>
            <dt className="text-ink-2">{t.quantity}</dt>
            <dd className="num text-right">{fmt(m.product.unitShort, { count: order.quantity })}</dd>
            <dt className="ticket-rule pt-1 font-semibold">{t.total}</dt>
            <dd className="ticket-rule pt-1 text-right">
              <Price amount={order.total} size="md" />
            </dd>
            {order.expressFee > 0 ? (
              <>
                <dt className="text-ink-2">{t.expressFee}</dt>
                <dd className="text-right">
                  <Price amount={order.expressFee} size="sm" />
                </dd>
              </>
            ) : null}
            {order.tip > 0 ? (
              <>
                <dt className="text-ink-2">{t.tip}</dt>
                <dd className="text-right">
                  <Price amount={order.tip} size="sm" />
                </dd>
              </>
            ) : null}
            {order.expressFee > 0 || order.tip > 0 ? (
              <>
                <dt className="text-ink-2">{t.charged}</dt>
                <dd className="text-right">
                  <Price amount={order.total + order.expressFee + order.tip} size="sm" />
                </dd>
              </>
            ) : null}
          </dl>
        </Panel>

        <Panel title={t.dates}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            {dates.map(([label, value]) => (
              <Field key={label} label={label}>
                <span className="num">{value ? formatDateTime(value) : m.common.none}</span>
              </Field>
            ))}
          </dl>
        </Panel>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-lg">{t.history}</h2>
        {order.events.length === 0 ? (
          <p className="text-sm text-ink-3">{t.historyEmpty}</p>
        ) : (
          <DataTable caption={t.history}>
            <thead>
              <tr>
                <th scope="col" className={th}>{t.historyColumns.date}</th>
                <th scope="col" className={th}>{t.historyColumns.from}</th>
                <th scope="col" className={th}>{t.historyColumns.to}</th>
                <th scope="col" className={th}>{t.historyColumns.note}</th>
              </tr>
            </thead>
            <tbody>
              {order.events.map((event) => (
                <tr key={event.id}>
                  <td className={`${td} num whitespace-nowrap text-ink-2`}>{formatDateTime(event.createdAt)}</td>
                  <td className={td}>{event.fromStatus ? m.status.order[event.fromStatus] : t.historyCreated}</td>
                  <td className={`${td} font-semibold`}>{orderStatusLabel(event.toStatus, { failureReason: order.failureReason })}</td>
                  <td className={`${td} whitespace-pre-line`}>{event.note ?? m.common.none}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>
    </>
  );
}
