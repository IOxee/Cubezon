import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/locales";

/**
 * Saves the visitor's language and reloads the same address: the proxy now routes it to the
 * other app/[lang] tree. A full load, so no page stays cached in the old language.
 */
export function switchLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  window.location.reload();
}
