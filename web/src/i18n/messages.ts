import { en } from "./en";
import { es } from "./es";
import type { Locale } from "./locales";

/** Literal types of `as const` texts widened to string, keeping the shape. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Widen<Item>[]
    : { readonly [Key in keyof T]: Widen<T[Key]> };

/** Shape of the texts, taken from English. Every language must have exactly these keys. */
export type Messages = Widen<typeof en>;

/**
 * Checked in both directions, so a key missing or left over in either language fails the
 * typecheck instead of showing an empty label at runtime.
 */
const DICTIONARIES: Record<Locale, Messages> = {
  en: en satisfies Widen<typeof es>,
  es: es satisfies Messages,
};

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale];
}
