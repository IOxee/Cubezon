"use client";

import { Fragment, useActionState, useState, type ReactNode } from "react";
import { fmt, m } from "@/i18n";
import type { DeliveryMethod } from "@/lib/delivery";
import { CommandText } from "@/components/shopping/command-text";
import { worldName } from "@/components/shopping/world-name";
import { Notice } from "@/components/ui/notice";
import { placeOrder, type PlaceOrderState } from "../actions";

export type CheckoutFormLine = { listingId: string; units: number; price: string };
export type CheckoutLocker = { id: string; name: string; world: string; x: number; y: number; z: number };
export type CheckoutMailbox = { id: string; world: string; x: number; y: number; z: number };

/** Express delivery offer: `fee` is the decimal the action checks again, `feeLabel` the formatted one. */
export type CheckoutExpress = { fee: string; feeLabel: string; mailboxes: CheckoutMailbox[] };

const INITIAL: PlaceOrderState = { error: null, details: [] };

/**
 * Checkout form: hidden lines (listing, units and the unit price the buyer reviewed), the
 * delivery choice (locker, or express to the buyer's mailbox when the server offers it) and the
 * confirm button. The server-rendered lines and receipts (with and without the express fee)
 * come as props.
 */
export function CheckoutForm({
  mode,
  lines,
  lockers,
  express,
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
  const selected = lockers.some((locker) => locker.id === lockerId) ? lockerId : (lockers[0]?.id ?? "");
  const mailboxes = express?.mailboxes ?? [];
  const selectedMailbox = mailboxes.some((mailbox) => mailbox.id === mailboxId) ? mailboxId : (mailboxes[0]?.id ?? "");
  const byMailbox = delivery === "MAILBOX" && express !== null && mailboxes.length > 0;
  const ready = canConfirm && (byMailbox ? selectedMailbox !== "" : lockers.length > 0);

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="delivery" value={byMailbox ? "MAILBOX" : "LOCKER"} />
      {byMailbox ? <input type="hidden" name="expressFee" value={express.fee} /> : null}
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
                badge={fmt(t.deliveryExpressFee, { fee: express.feeLabel })}
                hint={
                  mailboxes.length === 0 ? <CommandText template={t.noMailbox} command={m.commands.mailboxBuy} /> : t.deliveryExpressHint
                }
              />
            </div>
            {byMailbox && lines.length > 1 ? <p className="text-xs text-ink-3">{t.deliveryExpressOnce}</p> : null}
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
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        {byMailbox ? expressSummary : summary}
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
