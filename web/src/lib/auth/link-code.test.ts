import { describe, expect, it } from "vitest";
import { normalizeLinkCode, safeNextPath } from "./link-code";

describe("normalizeLinkCode", () => {
  it("accepts codes of the plugin alphabet", () => {
    expect(normalizeLinkCode("ABC234")).toBe("ABC234");
    expect(normalizeLinkCode("XYZ789")).toBe("XYZ789");
  });

  it("uppercases and strips spaces and dashes", () => {
    expect(normalizeLinkCode("abc234")).toBe("ABC234");
    expect(normalizeLinkCode(" ab c-234 ")).toBe("ABC234");
    expect(normalizeLinkCode("ABC-234")).toBe("ABC234");
  });

  it("rejects ambiguous characters (0, O, 1, I, L)", () => {
    for (const code of ["ABC230", "ABCO23", "ABC231", "ABCI23", "ABCL23"]) {
      expect(normalizeLinkCode(code)).toBeNull();
    }
  });

  it("rejects wrong lengths, symbols and non-strings", () => {
    for (const raw of ["", "ABC23", "ABC2345", "ABC23!", "ÁBC234", null, undefined, 123456, ["ABC234"]]) {
      expect(normalizeLinkCode(raw)).toBeNull();
    }
  });
});

describe("safeNextPath", () => {
  it("keeps relative paths inside the site", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout");
    expect(safeNextPath("/checkout?product=1&units=2")).toBe("/checkout?product=1&units=2");
    expect(safeNextPath("/orders/abc")).toBe("/orders/abc");
  });

  it("falls back for external or malformed targets", () => {
    for (const raw of ["https://evil.example", "//evil.example", "/\\evil.example", "checkout", "", null, undefined, 1]) {
      expect(safeNextPath(raw)).toBe("/account");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.example", "/")).toBe("/");
  });
});
