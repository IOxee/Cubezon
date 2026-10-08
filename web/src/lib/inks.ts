import type { CSSProperties } from "react";

/** Shop inks (palette of 8 in the database table public.inks; CSS vars in globals.css). */
export const INK_KEYS = ["azul", "burdeos", "botella", "violeta", "petroleo", "sepia", "grafito", "teja"] as const;

export type InkKey = (typeof INK_KEYS)[number];

export function isInkKey(value: unknown): value is InkKey {
  return typeof value === "string" && (INK_KEYS as readonly string[]).includes(value);
}

/** Style that sets --shop-ink on a container (use text-shop / border-shop inside). */
export function inkStyle(ink: string | null | undefined): CSSProperties {
  const key = isInkKey(ink) ? ink : "grafito";
  return { "--shop-ink": `var(--ink-${key})` } as CSSProperties;
}
