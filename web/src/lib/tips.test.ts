import { describe, expect, it } from "vitest";
import { parseTipInput, parseTipSettings, tipFieldName, tipsByLine } from "./tips";

const ON = { enabled: true, maxCents: 100000 };

describe("parseTipSettings", () => {
  it("is on only with 'true' and a cap above 0", () => {
    expect(parseTipSettings("true", "1000.00")).toEqual({ enabled: true, maxCents: 100000 });
    expect(parseTipSettings(" TRUE ", "2.5")).toEqual({ enabled: true, maxCents: 250 });
    expect(parseTipSettings("false", "1000")).toEqual({ enabled: false, maxCents: 100000 });
    expect(parseTipSettings("true", "0")).toEqual({ enabled: false, maxCents: 0 });
    expect(parseTipSettings("true", "-1")).toEqual({ enabled: false, maxCents: 0 });
    expect(parseTipSettings(undefined, undefined)).toEqual({ enabled: false, maxCents: 0 });
  });
});

describe("parseTipInput", () => {
  it("empty or zero is no tip", () => {
    expect(parseTipInput("", ON)).toEqual({ ok: true, cents: 0 });
    expect(parseTipInput("  ", ON)).toEqual({ ok: true, cents: 0 });
    expect(parseTipInput(null, ON)).toEqual({ ok: true, cents: 0 });
    expect(parseTipInput("0", ON)).toEqual({ ok: true, cents: 0 });
    expect(parseTipInput("0,00", { enabled: false, maxCents: 0 })).toEqual({ ok: true, cents: 0 });
  });

  it("accepts a decimal comma or point with up to 2 decimals", () => {
    expect(parseTipInput("12,5", ON)).toEqual({ ok: true, cents: 1250 });
    expect(parseTipInput("12.50", ON)).toEqual({ ok: true, cents: 1250 });
    expect(parseTipInput("1000", ON)).toEqual({ ok: true, cents: 100000 });
  });

  it("refuses malformed values, values above the cap and any tip while tips are off", () => {
    expect(parseTipInput("1.234", ON)).toEqual({ ok: false, error: "format" });
    expect(parseTipInput("-5", ON)).toEqual({ ok: false, error: "format" });
    expect(parseTipInput("abc", ON)).toEqual({ ok: false, error: "format" });
    expect(parseTipInput("1000,01", ON)).toEqual({ ok: false, error: "range" });
    expect(parseTipInput("5", { enabled: false, maxCents: 100000 })).toEqual({ ok: false, error: "off" });
  });
});

describe("tipsByLine", () => {
  it("puts each shop's tip once, on its most expensive line", () => {
    const lines = [
      { shopId: "a", totalCents: 500 },
      { shopId: "b", totalCents: 300 },
      { shopId: "a", totalCents: 900 },
      { shopId: "b", totalCents: 300 },
    ];
    expect(tipsByLine(lines, new Map([["a", 200], ["b", 150]]))).toEqual([0, 150, 200, 0]);
    expect(tipsByLine(lines, new Map([["b", 150]]))).toEqual([0, 150, 0, 0]);
    expect(tipsByLine([], new Map())).toEqual([]);
  });

  it("names one field per shop", () => {
    expect(tipFieldName("abc")).toBe("tip-abc");
  });
});
