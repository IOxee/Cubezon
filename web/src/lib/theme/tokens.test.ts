import { describe, expect, it } from "vitest";
import {
  BASE_TOKENS,
  checkContrast,
  contrastRatio,
  countOverrides,
  passesContrast,
  sanitizeTokens,
  themeCss,
} from "./tokens";

describe("contrastRatio", () => {
  it("matches the WCAG values for black and white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("base theme Cartilla", () => {
  it("passes every contrast rule in both modes", () => {
    const failures = checkContrast({ light: {}, dark: {} }).filter((check) => !check.ok);
    expect(failures).toEqual([]);
  });
});

describe("sanitizeTokens", () => {
  it("keeps valid known tokens that differ from the base, uppercased", () => {
    const tokens = sanitizeTokens({
      light: { paper: "#f0e0c0", ink: BASE_TOKENS.light.ink, unknown: "#000000", accent: "red" },
      dark: { surface: "#101010" },
      other: { paper: "#000000" },
    });
    expect(tokens).toEqual({ light: { paper: "#F0E0C0" }, dark: { surface: "#101010" } });
    expect(countOverrides(tokens)).toBe(2);
  });

  it("returns an empty theme for junk", () => {
    expect(sanitizeTokens(null)).toEqual({ light: {}, dark: {} });
    expect(sanitizeTokens("x")).toEqual({ light: {}, dark: {} });
  });
});

describe("passesContrast", () => {
  it("fails a theme with unreadable text", () => {
    const tokens = sanitizeTokens({ light: { "ink-3": "#E0D8C8" } });
    expect(passesContrast(tokens)).toBe(false);
    const failing = checkContrast(tokens).filter((check) => !check.ok);
    expect(failing.map((check) => `${check.mode}:${check.foreground}/${check.background}`)).toEqual([
      "light:ink-3/paper",
      "light:ink-3/surface",
    ]);
  });
});

describe("themeCss", () => {
  it("writes overrides for light, system dark and forced dark", () => {
    const css = themeCss({ light: { paper: "#F0E0C0" }, dark: { paper: "#101010" } });
    expect(css).toBe(
      "html:root{--paper:#F0E0C0;}" +
        "@media (prefers-color-scheme:dark){html:root:not([data-theme=light]){--paper:#101010;}}" +
        "html:root[data-theme=dark]{--paper:#101010;}",
    );
  });

  it("never lets non-color values through", () => {
    expect(themeCss({ light: { paper: "red;}body{display:none" } })).toBe("");
  });
});
