/**
 * Design tokens that a superadmin theme may override, the base theme ("Cartilla") and the
 * contrast rules a theme must pass before it can be activated or scheduled. Pure module.
 */

export const TOKEN_KEYS = [
  "paper",
  "surface",
  "ink",
  "ink-2",
  "ink-3",
  "line",
  "edge",
  "shadow",
  "danger",
  "success",
  "accent",
  "accent-hover",
  "on-accent",
] as const;

export type TokenKey = (typeof TOKEN_KEYS)[number];
export type Mode = "light" | "dark";
export const MODES: Mode[] = ["light", "dark"];
export type TokenSet = Record<TokenKey, string>;
/** Only the values that differ from the base theme are stored. */
export type ThemeTokens = Record<Mode, Partial<TokenSet>>;

/** Must match the values in src/app/globals.css. */
export const BASE_TOKENS: Record<Mode, TokenSet> = {
  light: {
    paper: "#ECE5D3",
    surface: "#F7F2E4",
    ink: "#1F2421",
    "ink-2": "#474C45",
    "ink-3": "#62655C",
    line: "#D4CAB2",
    edge: "#1F2421",
    shadow: "#C3B696",
    danger: "#A3271F",
    success: "#2E6838",
    accent: "#D9A21B",
    "accent-hover": "#C48F12",
    "on-accent": "#1F2421",
  },
  dark: {
    paper: "#161915",
    surface: "#20231F",
    ink: "#ECE4D0",
    "ink-2": "#BDB6A2",
    "ink-3": "#979181",
    line: "#373B34",
    edge: "#ECE4D0",
    shadow: "#0A0C09",
    danger: "#F08A7E",
    success: "#86C894",
    accent: "#E3B23C",
    "accent-hover": "#EDC25A",
    "on-accent": "#161915",
  },
};

const HEX = /^#[0-9A-F]{6}$/;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toUpperCase();
  return HEX.test(hex) ? hex : null;
}

/** Keeps only known tokens with valid #RRGGBB values that differ from the base theme. */
export function sanitizeTokens(raw: unknown): ThemeTokens {
  const result: ThemeTokens = { light: {}, dark: {} };
  if (!raw || typeof raw !== "object") return result;
  for (const mode of MODES) {
    const source = (raw as Record<string, unknown>)[mode];
    if (!source || typeof source !== "object") continue;
    for (const key of TOKEN_KEYS) {
      const hex = normalizeHex((source as Record<string, unknown>)[key]);
      if (hex && hex !== BASE_TOKENS[mode][key]) result[mode][key] = hex;
    }
  }
  return result;
}

export function resolveTokens(tokens: ThemeTokens, mode: Mode): TokenSet {
  return { ...BASE_TOKENS[mode], ...tokens[mode] };
}

export function countOverrides(tokens: ThemeTokens): number {
  return MODES.reduce((sum, mode) => sum + Object.keys(tokens[mode]).length, 0);
}

// Contrast (WCAG 2.x)

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastCheck = {
  mode: Mode;
  foreground: TokenKey;
  background: TokenKey;
  ratio: number;
  minimum: number;
  ok: boolean;
};

/** Text pairs need 4.5:1; outlines (and icons) 3:1. */
export const CONTRAST_PAIRS: { foreground: TokenKey; background: TokenKey; minimum: number }[] = [
  ...(["ink", "ink-2", "ink-3", "danger", "success"] as const).flatMap((foreground) =>
    (["paper", "surface"] as const).map((background) => ({ foreground, background, minimum: 4.5 })),
  ),
  { foreground: "on-accent", background: "accent", minimum: 4.5 },
  { foreground: "on-accent", background: "accent-hover", minimum: 4.5 },
  { foreground: "edge", background: "paper", minimum: 3 },
  { foreground: "edge", background: "surface", minimum: 3 },
];

export function checkContrast(tokens: ThemeTokens): ContrastCheck[] {
  return MODES.flatMap((mode) => {
    const set = resolveTokens(tokens, mode);
    return CONTRAST_PAIRS.map(({ foreground, background, minimum }) => {
      const ratio = contrastRatio(set[foreground], set[background]);
      return { mode, foreground, background, ratio, minimum, ok: ratio >= minimum };
    });
  });
}

export function passesContrast(tokens: ThemeTokens): boolean {
  return checkContrast(tokens).every((check) => check.ok);
}

// CSS

/** CSS custom properties for a set of tokens: "--paper:#ECE5D3;…". */
export function declarations(set: Partial<TokenSet>): string {
  return TOKEN_KEYS.filter((key) => set[key])
    .map((key) => `--${key}:${set[key]};`)
    .join("");
}

/**
 * CSS that overrides the base theme. Uses html:root so it wins over globals.css whatever the
 * stylesheet order, and follows the same light/dark rules (system or forced with data-theme).
 * Values are sanitized hex colors, so the output is safe to inline.
 */
export function themeCss(raw: unknown): string {
  const tokens = sanitizeTokens(raw);
  const light = declarations(tokens.light);
  const dark = declarations(tokens.dark);
  let css = "";
  if (light) css += `html:root{${light}}`;
  if (dark) {
    css += `@media (prefers-color-scheme:dark){html:root:not([data-theme=light]){${dark}}}`;
    css += `html:root[data-theme=dark]{${dark}}`;
  }
  return css;
}
