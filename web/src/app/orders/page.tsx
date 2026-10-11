import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { requirePlayer } from "@/lib/auth/session";
import { CART_MAX_LINES } from "@/lib/cart";
import { ORDERS_PAGE_SIZE, countMyOrders, listMyOrders, type OrderGroup, type OrderSummary } from "@/lib/data/orders";
import { getOrdersMode } from "@/lib/data/roleplay";
import { formatDate, serialOf } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { OrderStatusStamp } from "@/components/ui/order-status";
import { isProcessing, type OrdersMode } from "@/lib/order-display";
import { Price } from "@/components/ui/price";

export const metadata: Metadata = { title: m.account.orders.metaTitle };

const GROUPS = ["all", "active", "collected", "issues"] as const satisfies readonly OrderGroup[];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function groupFromSlug(slug: string | undefined): OrderGroup {
  return GROUPS.find((group) => group !== "all" && m.account.orders.tabs[group].slug === slug) ?? "all";
}

/** /pedidos?estado=<slug>&pagina=<n> (defaults are left out of the URL). */
function ordersHref(group: OrderGroup, page = 1): string {
  const params = new URLSearchParams();
  if (group !== "all") params.set("estado", m.account.orders.tabs[group].slug);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/pedidos?${query}` : "/pedidos";
}

export default function OrdersPage(props: PageProps<"/pedidos">) {
  const t = m.account.orders;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="label">{t.label}</p>
        <h1 className="text-2xl">{t.title}</h1>
      </header>
      <Suspense fallback={<OrdersSkeleton />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/pedidos">["searchParams"] }) {
  const t = m.account.orders;
  const params = await searchParams;
  const group = groupFromSlug(first(params.estado));
  const requestedPage = Math.max(1, Math.floor(Number(first(params.pagina)) || 1));
  const created = Math.floor(Number(first(params.nuevos)) || 0);

  const player = await requirePlayer(ordersHref(group, requestedPage));
  const [{ orders, total }, counts, mode] = await Promise.all([
    listMyOrders(player, { group, page: requestedPage }),
    countMyOrders(player),
    getOrdersMode(),
  ]);
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const empty = t.empty[group];

  return (
    <div className="flex flex-col gap-4">
      {created > 0 && created <= CART_MAX_LINES ? (
        <Notice tone="success">{plural(created, mode === "roleplay" ? m.roleplay.orders.created : t.created)}</Notice>
      ) : null}

      <nav aria-label={t.tabsLabel} className="scroll-row overflow-x-auto border-b-2 border-edge">
        <ul className="flex gap-1">
          {GROUPS.map((key) => {
            const current = key === group;
            return (
              <li key={key}>
                <Link
                  href={ordersHref(key)}
                  aria-current={current ? "page" : undefined}
                  className={`btn btn-ghost btn-sm gap-2 whitespace-nowrap ${current ? "font-semibold underline underline-offset-4" : "text-ink-2"}`}
                >
                  {t.tabs[key].name}
                  <span className={`badge num ${current ? "badge-ink" : "badge-paper"}`}>{counts[key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 && total > 0 ? (
        // A page past the end (old link): offer the first one.
        <Link href={ordersHref(group)} className="link">
          {fmt(t.page, { page: 1, pages })}
        </Link>
      ) : orders.length === 0 ? (
        <EmptyState
          title={empty.title}
          body={empty.body}
          icon="chest"
          action={
            group === "all" ? (
              <Link href="/buscar" className="btn btn-primary">
                {t.empty.all.cta}
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} mode={mode} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label={m.a11y.pagination} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={ordersHref(group, page - 1)} className="btn btn-sm">
              {t.newer}
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-sm text-ink-2">{fmt(t.page, { page, pages })}</span>
          {page < pages ? (
            <Link href={ordersHref(group, page + 1)} className="btn btn-sm">
              {t.older}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function OrderRow({ order, mode }: { order: OrderSummary; mode: OrdersMode }) {
  const t = m.account.orders;
  return (
    <li className="lift card relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="squares row-span-2 flex items-center justify-center self-start border border-line p-2 sm:row-span-1">
        <ItemIcon material={order.listing.material} size={48} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="num text-xs text-ink-3">
          {fmt(t.orderNumber, { serial: serialOf(order.id) })} · {formatDate(order.createdAt)}
        </p>
        <h2 className="text-base leading-snug font-semibold [font-stretch:100%]">
          <Link href={`/pedidos/${order.id}`} className="after:absolute after:inset-0 hover:underline">
            {order.listing.title}
          </Link>
        </h2>
        <p className="text-sm text-ink-2">
          <span className="text-shop" style={inkStyle(order.shop.ink)}>
            {order.shop.name}
          </span>{" "}
          · {order.delivery === "MAILBOX" ? t.mailbox : fmt(t.locker, { name: order.locker?.name ?? m.common.none })} ·{" "}
          {plural(order.quantity, t.units)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <Price amount={order.total + order.expressFee} size="lg" />
        <OrderStatusStamp
          status={order.status}
          processing={isProcessing(order)}
          mode={mode}
          failureReason={order.failureReason}
          delivery={order.delivery}
        />
      </div>
    </li>
  );
}

function OrdersSkeleton() {
  return (
    <div role="status" aria-label={m.a11y.loading} className="flex flex-col gap-3">
      <div className="skeleton h-10" />
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="skeleton h-20" />
      ))}
    </div>
  );
}
