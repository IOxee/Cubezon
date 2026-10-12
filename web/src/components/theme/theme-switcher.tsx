"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { useMessages } from "@/i18n/client";
import { PixelIcon } from "@/components/ui/pixel-icon";
import {
  THEME_PREFERENCES,
  applyThemePreference,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "./theme-preference";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ICONS = { system: "monitor", light: "sun", dark: "moon" } as const;

/** Segmented control system / light / dark. The choice lives in the cz-theme cookie. */
export function ThemeSwitcher({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const m = useMessages();
  // null on the server and while hydrating: only the browser knows the cookie.
  const current = useSyncExternalStore(subscribe, readThemePreference, () => null);

  // React's dev remount resets <html> attributes: re-apply the saved choice before paint.
  useLayoutEffect(() => applyThemePreference(readThemePreference()), []);

  function choose(preference: ThemePreference) {
    saveThemePreference(preference);
    listeners.forEach((listener) => listener());
  }

  const frame = inverted ? "border-paper/40" : "border-edge bg-surface";
  return (
    <div role="radiogroup" aria-label={m.theme.label} className={`inline-flex border ${frame}`}>
      {THEME_PREFERENCES.map((preference) => {
        const selected = current === preference;
        const colors = inverted
          ? selected
            ? "bg-paper text-ink"
            : "text-paper/80 hover:text-paper"
          : selected
            ? "bg-ink text-paper"
            : "text-ink-2 hover:text-ink";
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={compact ? m.theme[preference] : undefined}
            title={m.theme[preference]}
            onClick={() => choose(preference)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${colors}`}
          >
            <PixelIcon name={ICONS[preference]} size={compact ? 12 : 14} />
            {compact ? null : <span>{m.theme[preference]}</span>}
          </button>
        );
      })}
    </div>
  );
}
