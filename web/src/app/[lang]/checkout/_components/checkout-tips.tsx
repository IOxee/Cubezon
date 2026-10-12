"use client";

import { createContext, useContext, type ReactNode } from "react";
import { fmt } from "@/i18n";
import { useFormat } from "@/i18n/client";
import { fromCents } from "@/lib/format";
import { TicketRow } from "@/components/shopping/ticket";
import { Price } from "@/components/ui/price";

/**
 * Tips typed in the checkout form, for the server-rendered receipts: the form provides the sum
 * of the valid tips (cents) and these pieces of the receipt show it as the buyer types.
 */
const TipsContext = createContext(0);

export function TipsProvider({ tipCents, children }: { tipCents: number; children: ReactNode }) {
  return <TipsContext value={tipCents}>{children}</TipsContext>;
}

/** «Propina» row of the receipt, only with a tip. */
export function ReceiptTip({ label }: { label: string }) {
  const tipCents = useContext(TipsContext);
  const f = useFormat();
  return tipCents > 0 ? <TicketRow label={label} value={f.amount(fromCents(tipCents))} /> : null;
}

/** Total row of the receipt: what the server computed plus the tips. */
export function ReceiptTotal({ label, baseCents }: { label: string; baseCents: number }) {
  const tipCents = useContext(TipsContext);
  return <TicketRow label={label} value={<Price amount={fromCents(baseCents + tipCents)} size="md" />} strong />;
}

/** One line under the payment note when there is a tip (`template` has a {tip} placeholder). */
export function ReceiptTipNote({ template }: { template: string }) {
  const tipCents = useContext(TipsContext);
  const f = useFormat();
  return tipCents > 0 ? <p className="text-xs text-ink-2">{fmt(template, { tip: f.money(fromCents(tipCents)) })}</p> : null;
}
