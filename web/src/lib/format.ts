import { m } from "@/i18n";

/** Dates are shown in the server's community time zone so server and client render the same text. */
export const TIME_ZONE = "Europe/Madrid";
const LOCALE = "es-ES";

const amountFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const integerFormat = new Intl.NumberFormat(LOCALE, { useGrouping: "always" });

const ratingFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 1250.5 -> "1.250,50" (no currency). */
export function formatAmount(amount: number): string {
  return amountFormat.format(amount);
}

/** 1250.5 -> "1.250,50 $" (game money). */
export function formatMoney(amount: number): string {
  return formatAmount(amount) + m.money.suffix;
}

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatRating(value: number): string {
  return ratingFormat.format(value);
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

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "9 oct 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "09/10/2026, 16:30" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Short printable serial for a uuid: "4F2A-91C0". */
export function serialOf(id: string): string {
  const hex = id.replace(/-/g, "").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
