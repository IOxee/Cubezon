import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Messages } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { getOrdersMode } from "@/lib/data/roleplay";
import { getShopOrders, requireSellerShop } from "@/lib/data/seller";
import type { OrdersMode } from "@/lib/order-display";
import { panelPath } from "@/lib/seller/shops";
import { filterStatuses, ORDER_FILTERS, type OrderFilter } from "@/lib/seller/stats";
import { OrdersTable } from "@/components/seller/orders-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PanelHeader, PanelSkeleton } from "../../_components/panel-ui";
import { keyFromSlug, keySlug } from "@/lib/url-slug";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.seller.meta.orders };
}

const PAGE_SIZE = 25;
type Props = PageProps<"/[lang]/panel/[shop]/orders">;

export default async function OrdersPage({ params, searchParams }: Props) {
  const t = (await getMessages()).seller.orders;
  return (
    <>
      <PanelHeader title={t.title} />
      <Suspense fallback={<PanelSkeleton rows={8} />}>
        <Orders params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filterFromSlug(slug: string | undefined): OrderFilter {
  return keyFromSlug(ORDER_FILTERS, slug) ?? "all";
}

/** Filter labels: in roleplay mode PENDING and PAID read "Por aceptar" and "En preparación". */
function filterLabel(m: Messages, filter: OrderFilter, mode: OrdersMode): string {
  if (mode === "roleplay" && (filter === "PENDING" || filter === "PAID")) return m.roleplay.panel.filters[filter];
  return m.seller.orders.filters[filter].label;
}

function ordersHref(slug: string, filter: OrderFilter, page = 1): string {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("status", keySlug(filter));
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  const path = panelPath(slug, "orders");
  return search ? `${path}?${search}` : path;
}

async function Orders({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ shop: shopSlug }, query] = await Promise.all([params, searchParams]);
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "orders"));
  const filter = filterFromSlug(first(query.status));
  const page = Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1);
  const [{ orders, total }, mode, m] = await Promise.all([
    getShopOrders(shop.id, { statuses: filterStatuses(filter), page, pageSize: PAGE_SIZE }),
    getOrdersMode(),
    getMessages(),
  ]);
  const t = m.seller.orders;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {mode === "roleplay" ? <Notice>{m.roleplay.panel.ordersHint}</Notice> : null}

      <nav aria-label={t.filterLabel}>
        <ul className="scroll-row flex gap-1 overflow-x-auto pb-1">
          {ORDER_FILTERS.map((option) => (
            <li key={option}>
              <Link
                href={ordersHref(shop.slug, option)}
                aria-current={option === filter ? "page" : undefined}
                className={`btn btn-sm whitespace-nowrap ${option === filter ? "btn-ink" : "btn-ghost"}`}
              >
                {filterLabel(m, option, mode)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-sm text-ink-3">{plural(total, t.count)}</p>

      {orders.length > 0 ? (
        <OrdersTable orders={orders} caption={t.caption} mode={mode} />
      ) : filter === "all" && page === 1 ? (
        <EmptyState icon="chest" title={t.empty.title} body={t.empty.body} />
      ) : (
        <EmptyState icon="spyglass" title={t.emptyFiltered.title} body={t.emptyFiltered.body} />
      )}

      {pages > 1 ? (
        <nav aria-label={m.a11y.pagination} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={ordersHref(shop.slug, filter, page - 1)} className="btn btn-sm">
              {t.pagination.newer}
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-xs text-ink-3">{fmt(t.pagination.page, { page, pages })}</span>
          {page < pages ? (
            <Link href={ordersHref(shop.slug, filter, page + 1)} className="btn btn-sm">
              {t.pagination.older}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
