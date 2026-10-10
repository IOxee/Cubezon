import { describe, expect, it } from "vitest";
import { expressFeeByLine, parseDeliveryMethod, parseExpressSettings } from "./delivery";

describe("parseExpressSettings", () => {
  it("is on only with 'true' and a valid fee", () => {
    expect(parseExpressSettings("true", "100.00")).toEqual({ enabled: true, feeCents: 10000 });
    expect(parseExpressSettings(" TRUE ", "2.5")).toEqual({ enabled: true, feeCents: 250 });
    expect(parseExpressSettings("true", "0")).toEqual({ enabled: true, feeCents: 0 });
    expect(parseExpressSettings("false", "100.00")).toEqual({ enabled: false, feeCents: 10000 });
    expect(parseExpressSettings("true", "-5")).toEqual({ enabled: false, feeCents: 0 });
    expect(parseExpressSettings("true", "abc")).toEqual({ enabled: false, feeCents: 0 });
    expect(parseExpressSettings(undefined, undefined)).toEqual({ enabled: false, feeCents: 0 });
  });
});

describe("expressFeeByLine", () => {
  it("charges the fee once, on the most expensive line", () => {
    expect(expressFeeByLine([500, 2000, 1000], 300)).toEqual([0, 300, 0]);
    expect(expressFeeByLine([700, 700], 300)).toEqual([300, 0]);
    expect(expressFeeByLine([100], 300)).toEqual([300]);
    expect(expressFeeByLine([], 300)).toEqual([]);
  });
});

describe("parseDeliveryMethod", () => {
  it("defaults to the locker", () => {
    expect(parseDeliveryMethod("MAILBOX")).toBe("MAILBOX");
    expect(parseDeliveryMethod("LOCKER")).toBe("LOCKER");
    expect(parseDeliveryMethod("whatever")).toBe("LOCKER");
    expect(parseDeliveryMethod(null)).toBe("LOCKER");
  });
});
