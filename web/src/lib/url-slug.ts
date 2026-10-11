/**
 * URL tokens (values of query parameters such as ?status= or ?category=). They are English and do
 * not depend on the locale, so they live here and not in the i18n files: the lowercase form of the
 * key, with "_" written as "-" (READY -> "ready", best_selling -> "best-selling").
 */
export function keySlug(key: string): string {
  return key.toLowerCase().replaceAll("_", "-");
}

/** Key whose slug is `slug`, or null when none matches (missing or unknown value). */
export function keyFromSlug<K extends string>(keys: readonly K[], slug: string | null | undefined): K | null {
  if (!slug) return null;
  return keys.find((key) => keySlug(key) === slug) ?? null;
}
