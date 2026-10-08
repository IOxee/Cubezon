/** Link codes: 6 chars, no 0/O/1/I/L (same alphabet as the plugin and the DB check). */
export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[2-9A-HJKMNP-Z]{6}$/.test(code) ? code : null;
}

/** Only relative paths inside the site, to avoid open redirects after login. */
export function safeNextPath(raw: unknown, fallback = "/cuenta"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
