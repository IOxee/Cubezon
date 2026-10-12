import { describe, expect, it } from "vitest";
import { routeLocale } from "./locale-routing";

describe("routeLocale", () => {
  it("serves English when there is no cookie", () => {
    expect(routeLocale("/", undefined)).toEqual({ kind: "rewrite", pathname: "/en" });
    expect(routeLocale("/t/fractal", undefined)).toEqual({ kind: "rewrite", pathname: "/en/t/fractal" });
  });

  it("follows the cookie, ignoring unknown values", () => {
    expect(routeLocale("/search", "es")).toEqual({ kind: "rewrite", pathname: "/es/search" });
    expect(routeLocale("/search", "fr")).toEqual({ kind: "rewrite", pathname: "/en/search" });
  });

  it("turns an explicit language prefix into a redirect that saves it", () => {
    expect(routeLocale("/es/p/123", "en")).toEqual({ kind: "redirect", pathname: "/p/123", locale: "es" });
    expect(routeLocale("/en", "es")).toEqual({ kind: "redirect", pathname: "/", locale: "en" });
  });

  it("does not treat look-alike segments as a language", () => {
    expect(routeLocale("/english/x", undefined)).toEqual({ kind: "rewrite", pathname: "/en/english/x" });
  });
});
