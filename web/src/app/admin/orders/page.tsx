import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { DataTable, td, th } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination, firstParam, parsePage } from "@/components/admin/pagination";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusStamp } from "@/components/ui/order-status";
import { isProcessing } from "@/lib/order-display";
import { Price } from "@/components/ui/price";
import { fmt, m, plural } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import {
  ADMIN_PAGE_SIZE,
  ORDER_STATUSES,
  STALE_PENDING_MINUTES,
  listOrders,
  type OrderStatus,
} from "@/lib/data/admin";
import { formatDateTime, serialOf } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { keyFromSlug, keySlug } from "@/lib/url-slug";

export const metadata: Metadata = { title: m.admin.orders.title };

const t = m.admin.orders;

type SearchParams = PageProps<"/admin/orders">["searchParams"];

function statusFromSlug(slug: string): OrderStatus | null {
  return keyFromSlug(ORDER_STATUSES, slug);
}

export default function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <Suspense fallback={<TableSkeleton />}>
        <OrdersList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function Filters({ status, q }: { status: OrderStatus | null; q: string }) {
  return (
    // Keyed by the filters so "clear" also empties the fields.
    <Form
      key={`${status ?? ""}|${q}`}
      action="/admin/orders"
      role="search"
      aria-label={t.filters.label}
      className="mb-4 flex flex-wrap items-end gap-2"
    >
      <div>
        <label htmlFor="orders-status" className="label">
          {t.filters.status}
        </label>
        <select id="orders-status" name="status" defaultValue={status ? keySlug(status) : ""} className="input mt-1 text-sm">
          <option value="">{t.filters.allStatuses}</option>
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={keySlug(option)}>
              {m.status.order[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-48 flex-1">
        <label htmlFor="orders-q" className="label">
          {t.filters.search}
        </label>
        <input
          id="orders-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={40}
          placeholder={t.filters.searchPlaceholder}
          className="input mt-1 text-sm"
        />
      </div>
      <button type="submit" className="btn btn-ink">
        {t.filters.submit}
      </button>
      {status || q ? (
        <Link href="/admin/orders" className="btn btn-ghost">
          {t.filters.clear}
        </Link>
      ) : null}
    </Form>
  );
}

async function OrdersList({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const params = await searchParams;
  const status = statusFromSlug(firstParam(params.status));
  const q = firstParam(params.q).trim().slice(0, 40);
  const page = parsePage(params.page);

  const { orders, total } = await listOrders({ status, q, page });
  const filtered = Boolean(status || q);

  return (
    <>
      <Filters status={status} q={q} />
      <p className="mb-2 text-sm text-ink-2" role="status">
        {plural(total, t.results)}
      </p>

      {orders.length === 0 ? (
        <EmptyState
          icon="chest"
          title={filtered ? t.empty.title : t.emptyAll.title}
          body={filtered ? t.empty.body : t.emptyAll.body}
        />
      ) : (
        <DataTable caption={t.title}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t.columns.serial}</th>
              <th scope="col" className={th}>{t.columns.date}</th>
              <th scope="col" className={th}>{t.columns.buyer}</th>
              <th scope="col" className={th}>{t.columns.shop}</th>
              <th scope="col" className={th}>{t.columns.listing}</th>
              <th scope="col" className={th}>{t.columns.locker}</th>
              <th scope="col" className={`${th} text-right`}>{t.columns.total}</th>
              <th scope="col" className={th}>{t.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-paper">
                <td className={td}>
                  <Link href={`/admin/orders/${order.id}`} className="link num font-semibold whitespace-nowrap">
                    {serialOf(order.id)}
                  </Link>
                </td>
                <td className={`${td} num whitespace-nowrap text-ink-2`}>{formatDateTime(order.createdAt)}</td>
                <td className={`${td} font-semibold`}>{order.buyerName}</td>
                <td className={td} style={inkStyle(order.shop.ink)}>
                  <span className="text-shop">{order.shop.name}</span>
                </td>
                <td className={td}>{fmt(t.line, { quantity: order.quantity, title: order.listingTitle })}</td>
                <td className={td}>{order.delivery === "MAILBOX" ? t.mailbox : order.lockerName}</td>
                <td className={`${td} text-right`}>
                  <Price amount={order.total} size="sm" />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <span className="flex items-center gap-2">
                    <OrderStatusStamp
                      status={order.status}
                      processing={isProcessing(order)}
                      failureReason={order.failureReason}
                      delivery={order.delivery}
                    />
                    {order.stuck ? (
                      <span
                        className="badge border-danger text-danger"
                        title={fmt(t.stuckHint, { minutes: STALE_PENDING_MINUTES })}
                      >
                        {t.stuck}
                      </span>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <Pagination
        page={page}
        pageCount={Math.ceil(total / ADMIN_PAGE_SIZE)}
        basePath="/admin/orders"
        params={{ status: status ? keySlug(status) : "", q }}
      />
    </>
  );
}
