import { INTL_LOCALE, type Locale } from "@/i18n/locales";
import type { Messages } from "@/i18n/messages";

/** Dates are shown in the server's community time zone so server and client render the same text. */
export const TIME_ZONE = "Europe/Madrid";

/** Number and date formatting in the visitor's language. Get it with getFormat() or useFormat(). */
export type Format = {
  /** 1250.5 -> "1,250.50" (en) / "1.250,50" (es), no currency. */
  amount(amount: number): string;
  /** 1250.5 -> "1,250.50 $" (game money). */
  money(amount: number): string;
  integer(value: number): string;
  rating(value: number): string;
  /** "Oct 9, 2026" / "9 oct 2026" */
  date(iso: string): string;
  /** "10/09/2026, 04:30 PM" / "09/10/2026, 16:30" */
  dateTime(iso: string): string;
};

type Formatters = {
  amount: Intl.NumberFormat;
  integer: Intl.NumberFormat;
  rating: Intl.NumberFormat;
  date: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
};

/** Intl objects are expensive to build: one set per language, shared by every render. */
const formatters = new Map<Locale, Formatters>();

function formattersFor(locale: Locale): Formatters {
  const cached = formatters.get(locale);
  if (cached) return cached;
  const tag = INTL_LOCALE[locale];
  const created: Formatters = {
    amount: new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" }),
    integer: new Intl.NumberFormat(tag, { useGrouping: "always" }),
    rating: new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    date: new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" }),
    dateTime: new Intl.DateTimeFormat(tag, {
      timeZone: TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  formatters.set(locale, created);
  return created;
}

export function createFormat(locale: Locale, messages: Messages): Format {
  const f = formattersFor(locale);
  return {
    amount: (amount) => f.amount.format(amount),
    money: (amount) => f.amount.format(amount) + messages.money.suffix,
    integer: (value) => f.integer.format(value),
    rating: (value) => f.rating.format(value),
    date: (iso) => f.date.format(new Date(iso)),
    dateTime: (iso) => f.dateTime.format(new Date(iso)),
  };
}

/** Money as integer cents, to add and multiply without floating point errors. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Decimal string for numeric columns: 12345 cents -> "123.45". */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Short printable serial for a uuid: "4F2A-91C0". */
export function serialOf(id: string): string {
  const hex = id.replace(/-/g, "").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
