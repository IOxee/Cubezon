import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TilesSkeleton } from "@/components/admin/skeletons";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { fmt, m, plural } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { ORDER_STATUSES, STALE_PENDING_MINUTES, getAdminOverview } from "@/lib/data/admin";
import { getOrdersMode } from "@/lib/data/roleplay";
import { formatDateTime, formatInteger, serialOf } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-display";
import { keySlug } from "@/lib/url-slug";

export const metadata: Metadata = { title: m.admin.overview.title };

const t = m.admin.overview;

export default function AdminOverviewPage() {
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <Suspense fallback={<TilesSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

function Tile({
  label,
  value,
  detail,
  href,
  linkText,
  highlight = false,
}: {
  label: string;
  value: number;
  detail?: string;
  href?: string;
  linkText?: string;
  highlight?: boolean;
}) {
  return (
    <section className={`flex flex-col gap-1 p-4 ${highlight ? "card" : "card-soft"}`}>
      <h2 className="label">{label}</h2>
      <p className="flex items-baseline gap-2">
        <span className="num text-2xl font-semibold">{formatInteger(value)}</span>
        {detail ? <span className="num text-sm text-ink-2">{detail}</span> : null}
      </p>
      {href && linkText ? (
        <Link href={href} className="link mt-auto text-sm font-semibold">
          {linkText}
        </Link>
      ) : null}
    </section>
  );
}

async function Overview() {
  await requireStaff();
  const [data, mode] = await Promise.all([getAdminOverview(), getOrdersMode()]);
  const totalOrders = ORDER_STATUSES.reduce((sum, status) => sum + data.ordersByStatus[status], 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label={t.pendingShops}
          value={data.pendingShops}
          href="/admin/shops"
          linkText={t.pendingShopsLink}
          highlight={data.pendingShops > 0}
        />
        <Tile
          label={t.activeLockers}
          value={data.lockers.active}
          detail={fmt(t.activeLockersOf, { total: formatInteger(data.lockers.total) })}
          href="/admin/lockers"
          linkText={t.lockersLink}
        />
        <Tile label={t.players} value={data.players} detail={t.playersHint} />
      </div>

      <section className="card-soft flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <h2 className="label">{m.roleplay.admin.modeTitle}</h2>
        <span className="badge badge-ink">{m.roleplay.modes[mode]}</span>
        <p className="text-sm text-ink-2">{m.roleplay.admin.modeHint[mode]}</p>
        <p className="w-full text-xs text-ink-3">{m.roleplay.admin.modeChange}</p>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="text-lg">{t.ordersTitle}</h2>
          <Link href="/admin/orders" className="link text-sm font-semibold">
            {t.ordersLink} <span className="num text-ink-2">({formatInteger(totalOrders)})</span>
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {ORDER_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`/admin/orders?status=${keySlug(status)}`}
                className="card-soft lift flex flex-col gap-1 px-3 py-2"
              >
                <span className="label">{orderStatusLabel(status, { mode })}</span>
                <span className="num text-xl font-semibold">{formatInteger(data.ordersByStatus[status])}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg">{t.stuck.title}</h2>
        {data.stuck.count === 0 ? (
          <Notice tone="success">{fmt(t.stuck.none, { minutes: STALE_PENDING_MINUTES })}</Notice>
        ) : (
          <Notice tone={mode === "roleplay" ? "info" : "danger"}>
            <p className="font-semibold">
              {plural(data.stuck.count, t.stuck.warning, { minutes: STALE_PENDING_MINUTES })}
            </p>
            {/* In roleplay mode PENDING orders wait for their shop: not an alarm. */}
            <p className="mt-1">{mode === "roleplay" ? m.roleplay.admin.stuckHint : t.stuck.hint}</p>
            <p className={`label mt-3 ${mode === "roleplay" ? "" : "text-danger"}`}>{t.stuck.oldest}</p>
            <ul className="mt-1 grid gap-1 text-ink">
              {data.stuck.oldest.map((order) => (
                <li key={order.id} className="flex flex-wrap items-baseline gap-x-3">
                  <Link href={`/admin/orders/${order.id}`} className="link num font-semibold">
                    {serialOf(order.id)}
                  </Link>
                  <span className="num text-ink-2">{formatDateTime(order.createdAt)}</span>
                  <span>{order.buyerName}</span>
                  <Price amount={order.total} size="sm" />
                </li>
              ))}
            </ul>
          </Notice>
        )}
      </section>
    </div>
  );
}
