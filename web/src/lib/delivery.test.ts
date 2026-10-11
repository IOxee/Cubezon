import { describe, expect, it } from "vitest";
import {
  expressFeesByLine,
  leadLineByShop,
  parseDeliveryMethod,
  parseExpressSettings,
  shopExpressFeeCents,
  shopExpressFeeMaxCents,
  SHOP_EXPRESS_FEE_MAX_CENTS,
  validateShopExpressFee,
  type ExpressSettings,
} from "./delivery";

const settings = (pricing: ExpressSettings["pricing"], feeCents = 300, maxFeeCents = 500): ExpressSettings => ({
  enabled: true,
  feeCents,
  pricing,
  maxFeeCents,
});

describe("parseExpressSettings", () => {
  it("is on only with 'true' and a valid fee", () => {
    expect(parseExpressSettings("true", "100.00")).toMatchObject({ enabled: true, feeCents: 10000 });
    expect(parseExpressSettings(" TRUE ", "2.5")).toMatchObject({ enabled: true, feeCents: 250 });
    expect(parseExpressSettings("true", "0")).toMatchObject({ enabled: true, feeCents: 0 });
    expect(parseExpressSettings("false", "100.00")).toMatchObject({ enabled: false, feeCents: 10000 });
    expect(parseExpressSettings("true", "-5")).toMatchObject({ enabled: false, feeCents: 0 });
    expect(parseExpressSettings("true", "abc")).toMatchObject({ enabled: false, feeCents: 0 });
    expect(parseExpressSettings(undefined, undefined)).toEqual({
      enabled: false,
      feeCents: 0,
      pricing: "server",
      maxFeeCents: 0,
    });
  });

  it("reads the pricing mode and the cap", () => {
    expect(parseExpressSettings("true", "100", "shop-capped", "500.00")).toEqual({
      enabled: true,
      feeCents: 10000,
      pricing: "shop-capped",
      maxFeeCents: 50000,
    });
    expect(parseExpressSettings("true", "100", " SHOP ", "500")).toMatchObject({ pricing: "shop" });
  });

  it("falls back to server pricing and the server's fee as cap", () => {
    expect(parseExpressSettings("true", "100", "whatever", "nope")).toMatchObject({ pricing: "server", maxFeeCents: 10000 });
    expect(parseExpressSettings("true", "100", undefined, undefined)).toMatchObject({ pricing: "server", maxFeeCents: 10000 });
  });
});

describe("shopExpressFeeCents", () => {
  it("server: always the server's fee", () => {
    expect(shopExpressFeeCents(settings("server"), 50)).toBe(300);
    expect(shopExpressFeeCents(settings("server"), null)).toBe(300);
  });

  it("shop: the shop's own fee, or the server's without one", () => {
    expect(shopExpressFeeCents(settings("shop"), 50)).toBe(50);
    expect(shopExpressFeeCents(settings("shop"), 0)).toBe(0);
    expect(shopExpressFeeCents(settings("shop"), 9000)).toBe(9000);
    expect(shopExpressFeeCents(settings("shop"), null)).toBe(300);
  });

  it("shop-capped: the same, never above the cap", () => {
    expect(shopExpressFeeCents(settings("shop-capped"), 50)).toBe(50);
    expect(shopExpressFeeCents(settings("shop-capped"), 9000)).toBe(500);
    expect(shopExpressFeeCents(settings("shop-capped", 800, 500), null)).toBe(500);
  });
});

describe("leadLineByShop", () => {
  it("picks each shop's most expensive line, the first one on ties", () => {
    const lines = [
      { shopId: "a", totalCents: 700 },
      { shopId: "b", totalCents: 100 },
      { shopId: "a", totalCents: 700 },
      { shopId: "a", totalCents: 900 },
    ];
    expect(leadLineByShop(lines)).toEqual(
      new Map([
        ["a", 3],
        ["b", 1],
      ]),
    );
  });
});

describe("expressFeesByLine", () => {
  const line = (shopId: string, totalCents: number) => ({ shopId, totalCents });

  it("server: charges the fee once, on the most expensive line", () => {
    const server = settings("server");
    expect(expressFeesByLine([line("a", 500), line("b", 2000), line("a", 1000)], server)).toEqual([0, 300, 0]);
    expect(expressFeesByLine([line("a", 700), line("b", 700)], server)).toEqual([300, 0]);
    expect(expressFeesByLine([line("a", 100)], server)).toEqual([300]);
    expect(expressFeesByLine([], server)).toEqual([]);
  });

  it("per shop: each shop charges its fee once, on its own most expensive line", () => {
    const lines = [line("a", 500), line("b", 2000), line("a", 1000), line("c", 10)];
    const fees = new Map<string, number | null>([
      ["a", 100],
      ["b", null],
      ["c", 9000],
    ]);
    expect(expressFeesByLine(lines, settings("shop"), fees)).toEqual([0, 300, 100, 9000]);
    expect(expressFeesByLine(lines, settings("shop-capped"), fees)).toEqual([0, 300, 100, 500]);
    expect(expressFeesByLine(lines, settings("shop"))).toEqual([0, 300, 300, 300]);
  });
});

describe("validateShopExpressFee", () => {
  it("is locked while the server sets the fee", () => {
    expect(validateShopExpressFee(settings("server"), "5")).toEqual({ ok: false, error: "expressFeeLocked" });
  });

  it("empty means the server's fee", () => {
    expect(validateShopExpressFee(settings("shop"), "")).toEqual({ ok: true, cents: null });
    expect(validateShopExpressFee(settings("shop"), null)).toEqual({ ok: true, cents: null });
  });

  it("accepts 0 or more with up to 2 decimals", () => {
    expect(validateShopExpressFee(settings("shop"), "0")).toEqual({ ok: true, cents: 0 });
    expect(validateShopExpressFee(settings("shop"), "12,5")).toEqual({ ok: true, cents: 1250 });
    expect(validateShopExpressFee(settings("shop"), "-1")).toEqual({ ok: false, error: "expressFeeFormat" });
    expect(validateShopExpressFee(settings("shop"), "1.234")).toEqual({ ok: false, error: "expressFeeFormat" });
    expect(validateShopExpressFee(settings("shop"), "2000000000")).toEqual({ ok: false, error: "expressFeeRange" });
  });

  it("never above the cap in shop-capped mode", () => {
    expect(validateShopExpressFee(settings("shop-capped"), "5")).toEqual({ ok: true, cents: 500 });
    expect(validateShopExpressFee(settings("shop-capped"), "5,01")).toEqual({ ok: false, error: "expressFeeRange" });
    expect(shopExpressFeeMaxCents(settings("shop-capped"))).toBe(500);
    expect(shopExpressFeeMaxCents(settings("shop"))).toBe(SHOP_EXPRESS_FEE_MAX_CENTS);
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
