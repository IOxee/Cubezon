"use client";

import { useMessages } from "@/i18n/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { removeCartLineAction, updateCartLineAction } from "../actions";

/** Quantity picker of a cart line: submits as soon as it changes (button without JS). */
export function CartQuantity({ listingId, units, max }: { listingId: string; units: number; max: number }) {
  const m = useMessages();
  const t = m.shopping.cart;
  const id = `cart-units-${listingId}`;
  const options = Array.from({ length: Math.max(max, units) }, (_, i) => i + 1);
  return (
    <form action={updateCartLineAction} className="flex items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <label htmlFor={id} className="label">
        {t.units}
      </label>
      <select
        key={units}
        id={id}
        name="units"
        defaultValue={units}
        className="input num w-20"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn-sm">
          {t.update}
        </button>
      </noscript>
    </form>
  );
}

/** Sets the line to a given number of units (down to the stock left, without saying how many). */
export function CartAdjust({ listingId, units }: { listingId: string; units: number }) {
  const m = useMessages();
  return (
    <form action={updateCartLineAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="units" value={units} />
      <SubmitButton className="btn btn-sm" pendingLabel={m.common.saving}>
        {m.shopping.cart.adjust}
      </SubmitButton>
    </form>
  );
}

export function CartRemove({ listingId }: { listingId: string }) {
  const m = useMessages();
  const t = m.shopping.cart;
  return (
    <form action={removeCartLineAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <SubmitButton className="btn btn-ghost btn-sm text-danger" pendingLabel={t.removing}>
        {t.remove}
      </SubmitButton>
    </form>
  );
}
