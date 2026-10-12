import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
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
import { getExpressSettings, getMyMailboxes, getShopExpressFees, getTipSettings } from "@/lib/data/delivery";
import { getCheckoutListings } from "@/lib/data/orders";
import { getOrdersMode } from "@/lib/data/roleplay";
import { expressFeesByLine, shopsSetExpressFee } from "@/lib/delivery";
import { allowSelfPurchase } from "@/lib/dev-flags";
import { centsToDecimal, fromCents, toCents } from "@/lib/format";
import { checkoutProblemText } from "@/components/shopping/checkout-problem";
import { LineItemInfo } from "@/components/shopping/line-item";
import { Ticket, TicketHeader, TicketRow, TicketRule } from "@/components/shopping/ticket";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { CheckoutForm } from "./_components/checkout-form";
import { ReceiptTip, ReceiptTipNote, ReceiptTotal } from "./_components/checkout-tips";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.shopping.checkout.metaTitle };
}

export default async function CheckoutPage(props: PageProps<"/[lang]/checkout">) {
  const m = await getMessages();
  const t = m.shopping.checkout;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="label">{t.label}</p>
        <h1 className="text-2xl">{t.title}</h1>
        <p className="text-ink-2">{t.intro}</p>
      </header>
      {allowSelfPurchase() ? <Notice>{t.devSelfPurchase}</Notice> : null}
      <Suspense fallback={<CheckoutSkeleton m={m} />}>
        <Checkout searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Checkout({ searchParams }: { searchParams: PageProps<"/[lang]/checkout">["searchParams"] }) {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.shopping.checkout;
  const params = await searchParams;

  // "Buy now" from a product page (?product=&units=) or the whole cart.
  const listingParam = first(params.product);
  const single: CartLine | null = isUuid(listingParam)
    ? { listingId: listingParam.toLowerCase(), units: parseUnits(first(params.units)) ?? 1 }
    : null;
  const player = await requirePlayer(
    single ? `/checkout?product=${single.listingId}&units=${single.units}` : "/checkout",
  );
  const requested = single ? [single] : parseCart((await cookies()).get(CART_COOKIE)?.value);

  if (requested.length === 0) {
    return (
      <EmptyState
        title={t.empty.title}
        body={t.empty.body}
        icon="chest"
        action={
          <Link href="/search" className="btn btn-primary">
            {t.empty.cta}
          </Link>
        }
      />
    );
  }

  const [{ items, listings }, lockers, mode, express, mailboxes, tips] = await Promise.all([
    getCheckoutListings(requested.map((line) => line.listingId)),
    getActiveLockersFresh(),
    getOrdersMode(),
    getExpressSettings(),
    getMyMailboxes(player.uuid),
    getTipSettings(),
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
                  {row.units} × {f.money(row.item.unitPrice)}
                </p>
              </LineItemInfo>
            ) : (
              <p className="text-ink-3">{t.problems.unavailable}</p>
            )}
            {row.item && !row.problem ? <Price amount={fromCents(row.totalCents)} size="lg" /> : null}
            {row.problem && row.item ? (
              <Notice tone="danger" className="sm:max-w-xs">
                {checkoutProblemText(m, f, row.problem)}
              </Notice>
            ) : null}
          </li>
        ))}
      </ul>
      {!check.ok ? (
        <div className="border-t-2 border-edge p-4">
          <Notice tone="danger">
            {single ? t.fixSingle : t.fixInCart}{" "}
            <Link href={single ? `/p/${single.listingId}` : "/cart"} className="link font-semibold">
              {single ? t.backToProduct : t.backToCart}
            </Link>
          </Notice>
        </div>
      ) : null}
    </section>
  );

  // Express: once per purchase, or once per shop when shops set their fee (lib/delivery).
  const shops = uniqueShops(okLines.flatMap((row) => (row.item ? [row.item.shop] : [])));
  const perShop = express.enabled && shopsSetExpressFee(express);
  const shopFees = perShop ? await getShopExpressFees(shops.map((shop) => shop.id)) : new Map<string, number | null>();
  const chargeLines = okLines.map((row) => ({ shopId: row.item?.shop.id ?? "", totalCents: row.totalCents }));
  const lineFees = express.enabled ? expressFeesByLine(chargeLines, express, shopFees) : chargeLines.map(() => 0);
  const feeCents = lineFees.reduce((sum, fee) => sum + fee, 0);
  const shopFeeCents = (shopId: string) =>
    lineFees.reduce((sum, fee, index) => sum + (chargeLines[index].shopId === shopId ? fee : 0), 0);
  const expressRows = perShop ? (
    shops.map((shop) => (
      <TicketRow
        key={shop.id}
        label={fmt(t.expressFeeShop, { shop: shop.name })}
        value={f.amount(fromCents(shopFeeCents(shop.id)))}
      />
    ))
  ) : (
    <TicketRow label={t.expressFee} value={f.amount(fromCents(feeCents))} />
  );
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
          value={f.amount(fromCents(row.totalCents))}
        />
      ))}
      {withExpress ? expressRows : null}
      <ReceiptTip label={t.tipRow} />
      <TicketRule />
      <ReceiptTotal label={withExpress ? t.totalWithExpress : t.total} baseCents={totalCents + (withExpress ? feeCents : 0)} />
      <p className="text-xs text-ink-2">{plural(okLines.length, t.orderCount)}</p>
      <TicketRule />
      <p className="text-xs text-ink-2">
        {withExpress
          ? fmt(mode === "roleplay" ? m.roleplay.checkout.paymentExpress : t.paymentExpress, {
              total: f.money(fromCents(totalCents)),
              fee: f.money(fromCents(feeCents)),
            })
          : fmt(mode === "roleplay" ? m.roleplay.checkout.payment : t.payment, { total: f.money(fromCents(totalCents)) })}
      </p>
      <ReceiptTipNote template={t.tipNote} />
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
            ? { total: centsToDecimal(feeCents), totalLabel: f.money(fromCents(feeCents)), perShop, mailboxes }
            : null
        }
        shops={shops.map((shop) => ({ id: shop.id, name: shop.name }))}
        tips={tips.enabled ? tips : null}
        canConfirm={check.ok}
        items={itemsList}
        summary={receipt(false)}
        expressSummary={receipt(true)}
      />
      {!single ? (
        <p className="text-sm">
          <Link href="/cart" className="link">
            {t.backToCart}
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** Each shop once, in the order its first line appears. */
function uniqueShops<S extends { id: string }>(shops: S[]): S[] {
  return shops.filter((shop, index) => shops.findIndex((other) => other.id === shop.id) === index);
}

function CheckoutSkeleton({ m }: { m: Messages }) {
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
