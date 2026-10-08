import { es } from "./es";

/** Messages of the web (Spanish is the only locale for now). */
export const m = es;

export type Messages = typeof es;

/** Replaces {name} placeholders: fmt("Hola, {name}", { name: "Steve" }). */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type PluralForms = { one: string; other: string; zero?: string };

/** Picks the plural form and fills {count}: plural(3, m.cart.units) -> "3 unidades". */
export function plural(count: number, forms: PluralForms, values: Record<string, string | number> = {}): string {
  const template = count === 0 && forms.zero ? forms.zero : count === 1 ? forms.one : forms.other;
  return fmt(template, { count, ...values });
}
