/**
 * Languages of the web. English is the default; the visitor's choice lives in the cz-locale
 * cookie, which the proxy uses to route every URL to app/[lang] without changing the address.
 */
export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "cz-locale";

/** One year: the choice should survive until the visitor changes it. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** BCP 47 tag for Intl number and date formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
