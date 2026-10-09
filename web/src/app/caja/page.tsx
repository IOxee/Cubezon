import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { requirePlayer } from "@/lib/auth/session";
import {
  CART_COOKIE,
  lineTotalCents,
  parseCart,
  parseUnits,
  priceCheckout,
  type CartLine,
  type CheckoutProblem,
} from "@/lib/cart";
import { getActiveLockersFresh, isUuid } from "@/lib/data/catalog";
import { getExpressSettings, getMyMailboxes } from "@/lib/data/delivery";
import { getCheckoutListings } from "@/lib/data/orders";
import { getOrdersMode } from "@/lib/data/roleplay";
import { allowSelfPurchase } from "@/lib/dev-flags";
import { centsToDecimal, formatAmount, formatMoney, fromCents, toCents } from "@/lib/format";
import { checkoutProblemText } from "@/components/shopping/checkout-problem";
import { LineItemInfo } from "@/components/shopping/line-item";
import { Ticket, TicketHeader, TicketRow, TicketRule } from "@/components/shopping/ticket";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { CheckoutForm } from "./_components/checkout-form";

export const metadata: Metadata = { title: m.shopping.checkout.metaTitle };

export default function CheckoutPage(props: PageProps<"/caja">) {
  const t = m.shopping.checkout;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="label">{t.label}</p>
        <h1 className="text-2xl">{t.title}</h1>
        <p className="text-ink-2">{t.intro}</p>
      </header>
      {allowSelfPurchase() ? <Notice>{t.devSelfPurchase}</Notice> : null}
      <Suspense fallback={<CheckoutSkeleton />}>
        <Checkout searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Checkout({ searchParams }: { searchParams: PageProps<"/caja">["searchParams"] }) {
  const t = m.shopping.checkout;
  const params = await searchParams;

  // "Buy now" from a product page (?producto=&unidades=) or the whole cart.
  const listingParam = first(params.producto);
  const single: CartLine | null = isUuid(listingParam)
    ? { listingId: listingParam.toLowerCase(), units: parseUnits(first(params.unidades)) ?? 1 }
    : null;
  const player = await requirePlayer(
    single ? `/caja?producto=${single.listingId}&unidades=${single.units}` : "/caja",
  );
  const requested = single ? [single] : parseCart((await cookies()).get(CART_COOKIE)?.value);

  if (requested.length === 0) {
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

  const [{ items, listings }, lockers, mode, express, mailboxes] = await Promise.all([
    getCheckoutListings(requested.map((line) => line.listingId)),
    getActiveLockersFresh(),
    getOrdersMode(),
    getExpressSettings(),
    getMyMailboxes(player.uuid),
  ]);

  // Same checks as placeOrder, against the price shown now.
  const check = priceCheckout(
    requested.map((line) => ({
      listingId: line.listingId,
      units: line.units,
      expectedPriceCents: toCents(items.get(line.listingId)?.unitPrice ?? 0),
    })),
    listings,
    player.uuid,
    { allowOwnShop: allowSelfPurchase() },
  );
  const problems = new Map<string, CheckoutProblem>(
    check.ok ? [] : check.problems.map((problem) => [problem.listingId, problem]),
  );
  const rows = requested.map((line) => {
    const item = items.get(line.listingId);
    return { ...line, item, problem: problems.get(line.listingId), totalCents: item ? lineTotalCents(item.unitPrice, line.units) : 0 };
  });
  const totalCents = rows.reduce((sum, row) => sum + (row.problem ? 0 : row.totalCents), 0);
  const okLines = rows.filter((row) => !row.problem);

  const itemsList = (
    <section className="card">
      <h2 className="border-b-2 border-edge px-4 py-3 text-xl">{t.linesTitle}</h2>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.listingId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            {row.item ? (
              <LineItemInfo listing={row.item}>
                <p className="num text-sm text-ink-2">
                  {row.units} × {formatMoney(row.item.unitPrice)}
                </p>
              </LineItemInfo>
            ) : (
              <p className="text-ink-3">{t.problems.unavailable}</p>
            )}
            {row.item && !row.problem ? <Price amount={fromCents(row.totalCents)} size="lg" /> : null}
            {row.problem && row.item ? (
              <Notice tone="danger" className="sm:max-w-xs">
                {checkoutProblemText(row.problem)}
              </Notice>
            ) : null}
          </li>
        ))}
      </ul>
      {!check.ok ? (
        <div className="border-t-2 border-edge p-4">
          <Notice tone="danger">
            {single ? t.fixSingle : t.fixInCart}{" "}
            <Link href={single ? `/p/${single.listingId}` : "/carrito"} className="link font-semibold">
              {single ? t.backToProduct : t.backToCart}
            </Link>
          </Notice>
        </div>
      ) : null}
    </section>
  );

  // The express fee is charged once per purchase (lib/delivery: expressFeeByLine).
  const feeCents = express.enabled ? express.feeCents : 0;
  const receipt = (withExpress: boolean) => (
    <Ticket label={t.ticketHeader}>
      <TicketHeader title={m.meta.siteName} subtitle={t.ticketHeader} />
      <TicketRow label={t.buyer} value={player.name} muted />
      <TicketRule />
      {okLines.map((row) => (
        <TicketRow
          key={row.listingId}
          label={
            <span className="line-clamp-2">
              {row.item?.title} <span className="text-ink-2">×{row.units}</span>
            </span>
          }
          value={formatAmount(fromCents(row.totalCents))}
        />
      ))}
      {withExpress ? <TicketRow label={t.expressFee} value={formatAmount(fromCents(feeCents))} /> : null}
      <TicketRule />
      <TicketRow
        label={withExpress ? t.totalWithExpress : t.total}
        value={<Price amount={fromCents(totalCents + (withExpress ? feeCents : 0))} size="md" />}
        strong
      />
      <p className="text-xs text-ink-2">{plural(okLines.length, t.orderCount)}</p>
      <TicketRule />
      <p className="text-xs text-ink-2">
        {withExpress
          ? fmt(mode === "roleplay" ? m.roleplay.checkout.paymentExpress : t.paymentExpress, {
              total: formatMoney(fromCents(totalCents)),
              fee: formatMoney(fromCents(feeCents)),
            })
          : fmt(mode === "roleplay" ? m.roleplay.checkout.payment : t.payment, { total: formatMoney(fromCents(totalCents)) })}
      </p>
    </Ticket>
  );

  return (
    <>
      {mode === "roleplay" ? (
        <Notice>
          <p className="font-semibold">{m.roleplay.checkout.noticeTitle}</p>
          <p className="mt-1">{m.roleplay.checkout.notice}</p>
        </Notice>
      ) : null}
      <CheckoutForm
        mode={single ? "single" : "cart"}
        lines={okLines.map((row) => ({
          listingId: row.listingId,
          units: row.units,
          price: centsToDecimal(toCents(row.item?.unitPrice ?? 0)),
        }))}
        lockers={lockers}
        express={
          express.enabled
            ? { fee: centsToDecimal(feeCents), feeLabel: formatMoney(fromCents(feeCents)), mailboxes }
            : null
        }
        canConfirm={check.ok}
        items={itemsList}
        summary={receipt(false)}
        expressSummary={receipt(true)}
      />
      {!single ? (
        <p className="text-sm">
          <Link href="/carrito" className="link">
            {t.backToCart}
          </Link>
        </p>
      ) : null}
    </>
  );
}

function CheckoutSkeleton() {
  return (
    <div role="status" aria-label={m.a11y.loading} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <div className="skeleton h-48" />
        <div className="skeleton h-32" />
      </div>
      <div className="skeleton h-80" />
    </div>
  );
}
