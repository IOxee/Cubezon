"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCartAction, type AddToCartState } from "@/app/carrito/actions";
import { fmt, m, plural } from "@/i18n";
import { MAX_UNITS_PER_LINE, lineTotalCents, maxUnits } from "@/lib/cart";
import type { CatalogItem, Locker } from "@/lib/data/catalog";
import { formatMoney, fromCents } from "@/lib/format";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { Stamp } from "@/components/ui/stamp";
import { SubmitButton } from "@/components/ui/submit-button";

const INITIAL: AddToCartState = { status: "idle" };

/**
 * Purchase box of the product page: quantity, add to cart (cz-cart cookie) and buy now
 * (straight to the checkout with this listing only). The stock is not shown to the public: the
 * action and the checkout check it with fresh data and only say when there is not enough.
 */
export function BuyBox({ item, lockers }: { item: CatalogItem; lockers: Locker[] }) {
  const t = m.shopping.buyBox;
  const max = maxUnits(item.unitsAvailable);
  const [chosen, setChosen] = useState(1);
  const [state, formAction] = useActionState(addToCartAction, INITIAL);

  // The same box can stay mounted while navigating between products: ignore stale results.
  const result =
    state.status !== "idle" && (state.listingId === item.id || state.listingId === null) ? state : null;
  const units = Math.min(Math.max(1, chosen), MAX_UNITS_PER_LINE);
  const total = fromCents(lineTotalCents(item.unitPrice, units));

  return (
    <section aria-label={t.label} className="card flex flex-col gap-4 p-4">
      <div className="flex items-end justify-between gap-3">
        <Price amount={item.unitPrice} size="xl" />
        {max === 0 ? (
          <Stamp tone="danger" size="md" rotate={-5}>
            {m.common.soldOutStamp}
          </Stamp>
        ) : null}
      </div>

      {max === 0 ? (
        <button type="button" className="btn btn-lg btn-block" disabled>
          {m.common.soldOutStamp}
        </button>
      ) : (
        // React resets the form after the action: keep the chosen quantity in sync with it.
        <form action={formAction} onReset={() => setChosen(1)} className="flex flex-col gap-3">
          <input type="hidden" name="listingId" value={item.id} />
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`buy-units-${item.id}`} className="label">
                {t.units}
              </label>
              <select
                id={`buy-units-${item.id}`}
                name="units"
                value={units}
                onChange={(event) => setChosen(Number(event.target.value))}
                className="input num w-28"
              >
                {Array.from({ length: MAX_UNITS_PER_LINE }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto text-right">
              <p className="label">{t.total}</p>
              <Price amount={total} size="lg" />
            </div>
          </div>
          {item.unitAmount > 1 ? (
            <p className="text-xs text-ink-3">
              {plural(units * item.unitAmount, t.itemsTotal)} · {fmt(m.money.perItem, { price: formatMoney(item.pricePerItem) })}
            </p>
          ) : null}

          <SubmitButton className="btn btn-primary btn-lg btn-block" pendingLabel={t.adding}>
            {t.addToCart}
          </SubmitButton>
          <Link
            href={`/caja?producto=${item.id}&unidades=${units}`}
            className="btn btn-ink btn-lg btn-block"
            prefetch={false}
          >
            {t.buyNow}
          </Link>

          {result?.status === "added" ? (
            <Notice tone="success">
              <p>{plural(result.units, t.added)}</p>
              <Link href="/carrito" className="link mt-1 inline-block font-semibold">
                {t.viewCart}
              </Link>
            </Notice>
          ) : null}
          {result?.status === "error" ? <Notice tone="danger">{result.message}</Notice> : null}
        </form>
      )}

      <div className="perforation" />

      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="label">{t.pickupTitle}</dt>
          <dd className={lockers.length === 0 ? "text-danger" : "text-ink-2"}>
            {plural(lockers.length, t.pickup)}{" "}
            <Link href="/taquillas" className="link text-ink">
              {t.lockersLink}
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
