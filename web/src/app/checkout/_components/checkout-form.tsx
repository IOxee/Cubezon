"use client";

import { Fragment, useActionState, useState, type ReactNode } from "react";
import { fmt, m } from "@/i18n";
import type { DeliveryMethod } from "@/lib/delivery";
import { formatMoney, fromCents } from "@/lib/format";
import { parseTipInput, tipFieldName, type TipSettings } from "@/lib/tips";
import { CommandText } from "@/components/shopping/command-text";
import { worldName } from "@/components/shopping/world-name";
import { Notice } from "@/components/ui/notice";
import { placeOrder, type PlaceOrderState } from "../actions";
import { TipsProvider } from "./checkout-tips";

export type CheckoutFormLine = { listingId: string; units: number; price: string };
export type CheckoutLocker = { id: string; name: string; world: string; x: number; y: number; z: number };
export type CheckoutMailbox = { id: string; world: string; x: number; y: number; z: number };
/** A shop of the checkout (one tip field each). */
export type CheckoutShop = { id: string; name: string };

/**
 * Express delivery offer: `total` is the decimal sum of every express fee of the purchase, which
 * the action checks again; `totalLabel` the formatted one. `perShop`: each shop charges its own.
 */
export type CheckoutExpress = { total: string; totalLabel: string; perShop: boolean; mailboxes: CheckoutMailbox[] };

const INITIAL: PlaceOrderState = { error: null, details: [] };

/**
 * Checkout form: hidden lines (listing, units and the unit price the buyer reviewed), the
 * delivery choice (locker, or express to the buyer's mailbox when the server offers it), the
 * optional tip per shop and the confirm button. The server-rendered lines and receipts (with and
 * without the express fee) come as props; the receipts add the tips through TipsProvider.
 */
export function CheckoutForm({
  mode,
  lines,
  lockers,
  express,
  shops,
  tips,
  canConfirm,
  items,
  summary,
  expressSummary,
}: {
  mode: "cart" | "single";
  lines: CheckoutFormLine[];
  lockers: CheckoutLocker[];
  /** Null when express delivery is off. */
  express: CheckoutExpress | null;
  shops: CheckoutShop[];
  /** Null when tips are off. */
  tips: TipSettings | null;
  canConfirm: boolean;
  items: ReactNode;
  summary: ReactNode;
  expressSummary: ReactNode;
}) {
  const t = m.shopping.checkout;
  const [state, formAction, pending] = useActionState(placeOrder, INITIAL);
  const [delivery, setDelivery] = useState<DeliveryMethod>("LOCKER");
  const [lockerId, setLockerId] = useState(lockers[0]?.id ?? "");
  const [mailboxId, setMailboxId] = useState(express?.mailboxes[0]?.id ?? "");
  const [tipInputs, setTipInputs] = useState<Record<string, string>>({});
  const selected = lockers.some((locker) => locker.id === lockerId) ? lockerId : (lockers[0]?.id ?? "");
  const mailboxes = express?.mailboxes ?? [];
  const selectedMailbox = mailboxes.some((mailbox) => mailbox.id === mailboxId) ? mailboxId : (mailboxes[0]?.id ?? "");
  const byMailbox = delivery === "MAILBOX" && express !== null && mailboxes.length > 0;
  const tipResults = tips ? shops.map((shop) => parseTipInput(tipInputs[shop.id] ?? "", tips)) : [];
  const tipCents = tipResults.reduce((sum, tip) => sum + (tip.ok ? tip.cents : 0), 0);
  const tipsValid = tipResults.every((tip) => tip.ok);
  const ready = canConfirm && tipsValid && (byMailbox ? selectedMailbox !== "" : lockers.length > 0);

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="delivery" value={byMailbox ? "MAILBOX" : "LOCKER"} />
      {byMailbox ? <input type="hidden" name="expressTotal" value={express.total} /> : null}
      {lines.map((line) => (
        <Fragment key={line.listingId}>
          <input type="hidden" name="listingId" value={line.listingId} />
          <input type="hidden" name="units" value={line.units} />
          <input type="hidden" name="price" value={line.price} />
        </Fragment>
      ))}

      <div className="flex min-w-0 flex-col gap-6">
        {items}

        {express ? (
          <fieldset className="card flex flex-col gap-3 p-4">
            <legend className="float-left w-full text-xl font-bold [font-stretch:75%]">{t.deliveryTitle}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Option checked={!byMailbox} onSelect={() => setDelivery("LOCKER")} value="LOCKER" title={t.deliveryLocker} hint={t.deliveryLockerHint} />
              <Option
                checked={byMailbox}
                onSelect={() => setDelivery("MAILBOX")}
                value="MAILBOX"
                disabled={mailboxes.length === 0}
                title={t.deliveryExpress}
                badge={fmt(t.deliveryExpressFee, { fee: express.totalLabel })}
                hint={
                  mailboxes.length === 0 ? <CommandText template={t.noMailbox} command={m.commands.mailboxBuy} /> : t.deliveryExpressHint
                }
              />
            </div>
            {byMailbox && lines.length > 1 ? (
              <p className="text-xs text-ink-3">{express.perShop ? t.deliveryExpressOncePerShop : t.deliveryExpressOnce}</p>
            ) : null}
          </fieldset>
        ) : null}

        {byMailbox ? (
          <fieldset className="card flex flex-col gap-3 p-4">
            <legend className="float-left w-full text-xl font-bold [font-stretch:75%]">{t.mailboxTitle}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {mailboxes.map((mailbox) => (
                <label
                  key={mailbox.id}
                  className={`flex cursor-pointer items-start gap-3 border-2 p-3 ${
                    selectedMailbox === mailbox.id ? "border-edge bg-paper" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="mailbox"
                    value={mailbox.id}
                    checked={selectedMailbox === mailbox.id}
                    onChange={() => setMailboxId(mailbox.id)}
                    className="mt-1 size-4 accent-[var(--ink)]"
                  />
                  <span className="num text-sm text-ink-2">
                    {fmt(t.lockerCoords, { world: worldName(mailbox.world), x: mailbox.x, y: mailbox.y, z: mailbox.z })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset className="card flex flex-col gap-3 p-4" aria-describedby="locker-help">
            <legend className="float-left w-full text-xl font-bold [font-stretch:75%]">{t.lockerTitle}</legend>
            <p id="locker-help" className="-mt-2 text-sm text-ink-2">
              {t.lockerHelp}
            </p>
            {lockers.length === 0 ? (
              <Notice tone="danger">{t.noLockers}</Notice>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {lockers.map((locker) => (
                  <label
                    key={locker.id}
                    className={`flex cursor-pointer items-start gap-3 border-2 p-3 ${
                      selected === locker.id ? "border-edge bg-paper" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="locker"
                      value={locker.id}
                      checked={selected === locker.id}
                      onChange={() => setLockerId(locker.id)}
                      className="mt-1 size-4 accent-[var(--ink)]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{locker.name}</span>
                      <span className="num text-xs text-ink-3">
                        {fmt(t.lockerCoords, { world: worldName(locker.world), x: locker.x, y: locker.y, z: locker.z })}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {tips && shops.length > 0 ? (
          <fieldset className="card flex flex-col gap-3 p-4" aria-describedby="tip-help">
            <legend className="float-left w-full text-xl font-bold [font-stretch:75%]">{t.tipTitle}</legend>
            <p id="tip-help" className="-mt-2 text-sm text-ink-2">
              {fmt(t.tipHelp, { max: formatMoney(fromCents(tips.maxCents)) })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {shops.map((shop, index) => {
                const id = `tip-${index}`;
                const result = tipResults[index];
                const invalid = result !== undefined && !result.ok;
                return (
                  <div key={shop.id}>
                    <label htmlFor={id} className="label">
                      {shop.name}
                    </label>
                    <input
                      id={id}
                      name={tipFieldName(shop.id)}
                      value={tipInputs[shop.id] ?? ""}
                      onChange={(event) => setTipInputs((current) => ({ ...current, [shop.id]: event.target.value }))}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={t.tipPlaceholder}
                      className="input num w-full"
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={`tip-help ${id}-error`}
                    />
                    <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger empty:hidden">
                      {invalid ? fmt(t.tipInvalid, { max: formatMoney(fromCents(tips.maxCents)) }) : null}
                    </p>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        <TipsProvider tipCents={tipCents}>{byMailbox ? expressSummary : summary}</TipsProvider>
        {state.error ? (
          <Notice tone="danger">
            <p>{state.error}</p>
            {state.details.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {state.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </Notice>
        ) : null}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!ready || pending} aria-disabled={!ready || pending}>
          {pending ? t.confirming : t.confirm}
        </button>
      </aside>
    </form>
  );
}

/** One delivery option (radio card). */
function Option({
  value,
  checked,
  onSelect,
  disabled = false,
  title,
  badge,
  hint,
}: {
  value: DeliveryMethod;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  badge?: string;
  hint: ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 border-2 p-3 ${
        disabled ? "cursor-not-allowed border-line opacity-70" : checked ? "cursor-pointer border-edge bg-paper" : "cursor-pointer border-line"
      }`}
    >
      <input
        type="radio"
        name="deliveryChoice"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 size-4 accent-[var(--ink)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {badge ? <span className="badge badge-paper num">{badge}</span> : null}
        </span>
        <span className="text-xs text-ink-2">{hint}</span>
      </span>
    </label>
  );
}
