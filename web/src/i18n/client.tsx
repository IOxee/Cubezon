"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createFormat, type Format } from "@/lib/format";
import type { Locale } from "./locales";
import type { Messages } from "./messages";

type I18n = { locale: Locale; messages: Messages };

const I18nContext = createContext<I18n | null>(null);

/** Set once in the root layout with the page's language; Client Components read it with the hooks below. */
export function I18nProvider({ locale, messages, children }: I18n & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error("useMessages() needs <I18nProvider> (it is set in app/[lang]/layout.tsx)");
  return i18n;
}

export function useMessages(): Messages {
  return useI18n().messages;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useFormat(): Format {
  const { locale, messages } = useI18n();
  return useMemo(() => createFormat(locale, messages), [locale, messages]);
}
