import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/locales";
import { routeLocale } from "@/lib/locale-routing";

/** Routes every page to app/[lang] by the cz-locale cookie (English by default). */
export function proxy(request: NextRequest) {
  const route = routeLocale(request.nextUrl.pathname, request.cookies.get(LOCALE_COOKIE)?.value);
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;

  if (route.kind === "rewrite") return NextResponse.rewrite(url);

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, route.locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
  return response;
}

export const config = {
  // Everything except Next's own files and anything with an extension (favicon, images).
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
