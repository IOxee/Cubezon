import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { CART_COOKIE, MAX_UNITS_PER_LINE, cartUnits, lineTotalCents, maxUnits, parseCart, stockProblem } from "@/lib/cart";
import { getCatalogItemsFresh, type CatalogItem } from "@/lib/data/catalog";
import { formatAmount, formatMoney, fromCents } from "@/lib/format";
import { LineItemInfo } from "@/components/shopping/line-item";
import { Ticket, TicketHeader, TicketRow, TicketRule } from "@/components/shopping/ticket";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { CartAdjust, CartQuantity, CartRemove } from "./_components/cart-line-controls";

export const metadata: Metadata = { title: m.shopping.cart.metaTitle };

export default function CartPage() {
  const t = m.shopping.cart;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="label">{t.label}</p>
        <h1 className="text-2xl">{t.title}</h1>
      </header>
      <Suspense fallback={<CartSkeleton />}>
        <CartContents />
      </Suspense>
    </div>
  );
}

type Row = {
  listingId: string;
  units: number;
  item: CatalogItem | undefined;
  problem: ReturnType<typeof stockProblem>;
  totalCents: number;
};

async function CartContents() {
  const t = m.shopping.cart;
  const lines = parseCart((await cookies()).get(CART_COOKIE)?.value);
  if (lines.length === 0) {
    return (
      <EmptyState
        title={t.empty.title}
        body={t.empty.body}
        icon="chest"
        action={
          <Link href="/buscar" className="btn btn-primary">
            {t.empty.cta}
          </Link>
        }
      />
    );
  }

  const items = await getCatalogItemsFresh(lines.map((line) => line.listingId));
  const rows: Row[] = lines.map((line) => {
    const item = items.get(line.listingId);
    const problem = stockProblem(item?.unitsAvailable, line.units);
    return {
      ...line,
      item,
      problem,
      totalCents: item && !problem ? lineTotalCents(item.unitPrice, line.units) : 0,
    };
  });
  const valid = rows.filter((row): row is Row & { item: CatalogItem } => Boolean(row.item) && !row.problem);
  const subtotalCents = valid.reduce((sum, row) => sum + row.totalCents, 0);
  const hasProblems = valid.length !== rows.length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label={t.linesLabel} className="card">
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.listingId} className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-start">
              {row.item ? (
                <div className="min-w-0 flex-1">
                  <LineItemInfo listing={row.item}>
                    <p className="num text-sm text-ink-2">
                      {fmt(t.unitPrice, { price: formatMoney(row.item.unitPrice) })}
                    </p>
                  </LineItemInfo>
                </div>
              ) : (
                <p className="flex-1 text-ink-3">{t.problems.unavailable}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                {row.item && row.problem !== "sold_out" ? (
                  <CartQuantity listingId={row.listingId} units={row.units} max={MAX_UNITS_PER_LINE} />
                ) : null}
                {row.item && !row.problem ? (
                  <p className="text-right">
                    <span className="sr-only">{t.lineTotal}: </span>
                    <Price amount={fromCents(row.totalCents)} size="lg" />
                  </p>
                ) : null}
                <CartRemove listingId={row.listingId} />
              </div>

              {row.item && row.problem ? (
                <Notice tone="danger" className="sm:basis-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{t.problems[row.problem]}</span>
                    {row.problem === "not_enough_stock" ? (
                      <CartAdjust listingId={row.listingId} units={maxUnits(row.item.unitsAvailable)} />
                    ) : null}
                  </div>
                </Notice>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        <Ticket label={t.ticketTitle}>
          <TicketHeader title={m.meta.siteName} subtitle={t.ticketHeader} />
          <TicketRule />
          {valid.map((row) => (
            <TicketRow
              key={row.listingId}
              label={
                <span className="line-clamp-2">
                  {row.item.title} <span className="text-ink-2">×{row.units}</span>
                </span>
              }
              value={formatAmount(fromCents(row.totalCents))}
            />
          ))}
          <TicketRule />
          <TicketRow label={t.subtotal} value={<Price amount={fromCents(subtotalCents)} size="md" />} strong />
          <p className="text-xs text-ink-2">{plural(cartUnits(valid), t.count)}</p>
        </Ticket>

        {hasProblems ? <Notice tone="danger">{t.fixFirst}</Notice> : null}
        {hasProblems || valid.length === 0 ? (
          <span aria-disabled="true" className="btn btn-primary btn-lg btn-block">
            {t.checkout}
          </span>
        ) : (
          <Link href="/caja" className="btn btn-primary btn-lg btn-block">
            {t.checkout}
          </Link>
        )}
        <Link href="/buscar" className="link text-center text-sm">
          {t.continueShopping}
        </Link>
      </aside>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div role="status" aria-label={m.a11y.loading} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="card flex flex-col gap-4 p-4">
        {[0, 1, 2].map((n) => (
          <div key={n} className="skeleton h-20" />
        ))}
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}
