import "server-only";
import { cookies } from "next/headers";
import { lang } from "next/root-params";
import { createFormat, type Format } from "@/lib/format";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";
import { messagesFor, type Messages } from "./messages";

/**
 * Language of the page being rendered: the [lang] root segment the proxy routes every URL to.
 * Works in any Server Component (and inside "use cache", where it becomes part of the key).
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}

export async function getFormat(): Promise<Format> {
  const locale = await getLocale();
  return createFormat(locale, messagesFor(locale));
}

/**
 * Server Actions cannot read root params, so they use the visitor's cookie: the same value the
 * proxy routed the page by, so the action answers in the language the form was shown in.
 */
export async function getActionLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getActionMessages(): Promise<Messages> {
  return messagesFor(await getActionLocale());
}

export async function getActionFormat(): Promise<Format> {
  const locale = await getActionLocale();
  return createFormat(locale, messagesFor(locale));
}
