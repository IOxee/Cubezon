/**
 * Texts of the web, in English (default) and Spanish. Read them with getMessages() in Server
 * Components, getActionMessages() in Server Actions (both in ./server) and useMessages() in
 * Client Components (./client). Never import a dictionary directly.
 */
export type { Messages } from "./messages";
export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales";

/** Replaces {name} placeholders: fmt("Hello, {name}", { name: "Steve" }). */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type PluralForms = { readonly one: string; readonly other: string; readonly zero?: string };

/** Picks the plural form and fills {count}: plural(3, m.cart.units) -> "3 units". */
export function plural(count: number, forms: PluralForms, values: Record<string, string | number> = {}): string {
  const template = count === 0 && forms.zero ? forms.zero : count === 1 ? forms.one : forms.other;
  return fmt(template, { count, ...values });
}
