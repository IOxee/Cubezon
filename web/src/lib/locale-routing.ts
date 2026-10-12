import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locales";

/**
 * What the proxy does with a request:
 * - rewrite: serve app/[lang]/<path> for the visitor's language, keeping the address as is;
 * - redirect: an explicit /en/... or /es/... link (to share a language) goes to the plain
 *   address and saves that language in the cookie.
 */
export type LocaleRoute =
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; pathname: string; locale: Locale };

export function routeLocale(pathname: string, cookieValue: string | undefined): LocaleRoute {
  const [, first = "", ...rest] = pathname.split("/");
  if (isLocale(first)) {
    return { kind: "redirect", pathname: `/${rest.join("/")}`, locale: first };
  }
  const locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
  return { kind: "rewrite", pathname: pathname === "/" ? `/${locale}` : `/${locale}${pathname}` };
}
