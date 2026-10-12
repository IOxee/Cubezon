"use client";

import { useLocale, useMessages } from "@/i18n/client";
import { LOCALES, type Locale } from "@/i18n/locales";
import { switchLocale } from "./locale-preference";

/** Segmented control EN / ES. The choice lives in the cz-locale cookie, which the proxy routes by. */
export function LocaleSwitcher({ inverted = false }: { inverted?: boolean }) {
  const m = useMessages();
  const current = useLocale();

  function choose(locale: Locale) {
    if (locale !== current) switchLocale(locale);
  }

  const frame = inverted ? "border-paper/40" : "border-edge bg-surface";
  return (
    <div role="radiogroup" aria-label={m.language.label} className={`inline-flex border ${frame}`}>
      {LOCALES.map((locale) => {
        const selected = current === locale;
        const colors = inverted
          ? selected
            ? "bg-paper text-ink"
            : "text-paper/80 hover:text-paper"
          : selected
            ? "bg-ink text-paper"
            : "text-ink-2 hover:text-ink";
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={m.language[locale]}
            title={m.language[locale]}
            lang={locale}
            onClick={() => choose(locale)}
            className={`num px-2 py-0.5 text-xs font-semibold uppercase ${colors}`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
