/** The visitor's theme choice: "system" follows prefers-color-scheme; the others force it. */
export const THEME_COOKIE = "cz-theme";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

const PATTERN = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)`);

export function readThemePreference(): ThemePreference {
  return (document.cookie.match(PATTERN)?.[1] as ThemePreference | undefined) ?? "system";
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function saveThemePreference(preference: ThemePreference): void {
  document.cookie =
    preference === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
  applyThemePreference(preference);
}

/**
 * Inline script for <head>: applies a forced theme while the HTML is parsed, before the first
 * paint. Reading the cookie here (and not with cookies() in the layout) keeps every page static.
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;
