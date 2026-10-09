import { describe, expect, it } from "vitest";
import {
  CART_MAX_LINES,
  MAX_UNITS_PER_LINE,
  addToCart,
  cartUnits,
  decimalToCents,
  lineTotalCents,
  maxUnits,
  parseCart,
  parseCheckoutLines,
  parseUnits,
  priceCheckout,
  removeFromCart,
  serializeCart,
  setCartUnits,
  stockProblem,
  type CheckoutListing,
} from "./cart";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const BUYER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SELLER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

describe("parseCart", () => {
  it("returns an empty cart for missing or broken cookies", () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart("")).toEqual([]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
  });

  it("skips malformed entries and lowercases ids", () => {
    const raw = JSON.stringify([[A.toUpperCase(), 2], ["nope", 1], [B, 0], [B, 1.5], [C, "3"], "x", [C]]);
    expect(parseCart(raw)).toEqual([
      { listingId: A, units: 2 },
      { listingId: C, units: 3 },
    ]);
  });

  it("merges repeated listings and caps units at 64", () => {
    expect(parseCart(JSON.stringify([[A, 40], [A, 40]]))).toEqual([{ listingId: A, units: MAX_UNITS_PER_LINE }]);
  });

  it("keeps at most CART_MAX_LINES lines", () => {
    const raw = JSON.stringify(Array.from({ length: CART_MAX_LINES + 5 }, (_, i) => [uuid(i), 1]));
    expect(parseCart(raw)).toHaveLength(CART_MAX_LINES);
  });

  it("round-trips through serializeCart", () => {
    const lines = [
      { listingId: A, units: 3 },
      { listingId: B, units: 1 },
    ];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
  });
});

describe("cart updates", () => {
  it("adds a new line and accumulates units on an existing one", () => {
    let lines = addToCart([], A, 2);
    lines = addToCart(lines, B, 1);
    lines = addToCart(lines, A.toUpperCase(), 3);
    expect(lines).toEqual([
      { listingId: A, units: 5 },
      { listingId: B, units: 1 },
    ]);
    expect(cartUnits(lines)).toBe(6);
  });

  it("caps added units at 64", () => {
    expect(addToCart([{ listingId: A, units: 60 }], A, 10)).toEqual([{ listingId: A, units: 64 }]);
    expect(addToCart([], A, 100)).toEqual([{ listingId: A, units: 64 }]);
  });

  it("does not grow beyond CART_MAX_LINES", () => {
    const full = Array.from({ length: CART_MAX_LINES }, (_, i) => ({ listingId: uuid(i), units: 1 }));
    expect(addToCart(full, A, 1)).toHaveLength(CART_MAX_LINES);
  });

  it("sets units and removes the line with 0", () => {
    const lines = [
      { listingId: A, units: 2 },
      { listingId: B, units: 1 },
    ];
    expect(setCartUnits(lines, A, 7)).toEqual([
      { listingId: A, units: 7 },
      { listingId: B, units: 1 },
    ]);
    expect(setCartUnits(lines, A, 0)).toEqual([{ listingId: B, units: 1 }]);
    expect(setCartUnits(lines, A, 99)[0].units).toBe(64);
  });

  it("removes several listings at once", () => {
    const lines = [
      { listingId: A, units: 2 },
      { listingId: B, units: 1 },
      { listingId: C, units: 4 },
    ];
    expect(removeFromCart(lines, [A, C.toUpperCase()])).toEqual([{ listingId: B, units: 1 }]);
  });
});

describe("parseUnits and maxUnits", () => {
  it("accepts integers between 1 and the max", () => {
    expect(parseUnits("1")).toBe(1);
    expect(parseUnits(" 64 ")).toBe(64);
    expect(parseUnits("5", 5)).toBe(5);
  });

  it("rejects anything else", () => {
    for (const raw of ["0", "65", "-1", "1.5", "abc", "", "1e2", null, 3]) {
      expect(parseUnits(raw)).toBeNull();
    }
    expect(parseUnits("6", 5)).toBeNull();
    expect(parseUnits("65", 100)).toBeNull();
  });

  it("limits the selectable quantity to stock and 64", () => {
    expect(maxUnits(0)).toBe(0);
    expect(maxUnits(3)).toBe(3);
    expect(maxUnits(500)).toBe(64);
  });
});

describe("stockProblem", () => {
  it("flags missing, sold out and short lines", () => {
    expect(stockProblem(null, 1)).toBe("unavailable");
    expect(stockProblem(undefined, 1)).toBe("unavailable");
    expect(stockProblem(0, 1)).toBe("sold_out");
    expect(stockProblem(2, 3)).toBe("not_enough_stock");
    expect(stockProblem(3, 3)).toBeNull();
  });
});

describe("money", () => {
  it("parses decimal strings to cents", () => {
    expect(decimalToCents("123.45")).toBe(12345);
    expect(decimalToCents("123.4")).toBe(12340);
    expect(decimalToCents("7")).toBe(700);
    expect(decimalToCents("0.10")).toBe(10);
  });

  it("rejects malformed amounts", () => {
    for (const raw of ["", "-1", "1.234", "1,5", "abc", "1.", ".5", undefined, 12]) {
      expect(decimalToCents(raw)).toBeNull();
    }
  });

  it("multiplies in cents without floating point drift", () => {
    expect(lineTotalCents(0.1, 3)).toBe(30);
    expect(lineTotalCents(19.99, 64)).toBe(127936);
    expect(lineTotalCents(1234567.89, 64)).toBe(7901234496);
  });
});

describe("parseCheckoutLines", () => {
  it("parses parallel lists", () => {
    expect(parseCheckoutLines([A, B.toUpperCase()], ["2", "64"], ["10.50", "3"])).toEqual([
      { listingId: A, units: 2, expectedPriceCents: 1050 },
      { listingId: B, units: 64, expectedPriceCents: 300 },
    ]);
  });

  it("rejects malformed forms", () => {
    expect(parseCheckoutLines([], [], [])).toBeNull();
    expect(parseCheckoutLines([A], ["1", "2"], ["1"])).toBeNull();
    expect(parseCheckoutLines(["x"], ["1"], ["1"])).toBeNull();
    expect(parseCheckoutLines([A], ["0"], ["1"])).toBeNull();
    expect(parseCheckoutLines([A], ["65"], ["1"])).toBeNull();
    expect(parseCheckoutLines([A], ["1"], ["0"])).toBeNull();
    expect(parseCheckoutLines([A], ["1"], ["1.999"])).toBeNull();
    expect(parseCheckoutLines([A, A.toUpperCase()], ["1", "1"], ["1", "1"])).toBeNull();
    const many = Array.from({ length: CART_MAX_LINES + 1 }, (_, i) => uuid(i));
    expect(parseCheckoutLines(many, many.map(() => "1"), many.map(() => "1"))).toBeNull();
  });
});

describe("priceCheckout", () => {
  const listing = (id: string, overrides: Partial<CheckoutListing> = {}): CheckoutListing => ({
    id,
    shopId: `shop-${id}`,
    shopOwnerUuid: SELLER,
    unitPrice: 12.5,
    unitsAvailable: 10,
    ...overrides,
  });

  it("prices valid lines with exact decimal strings", () => {
    const listings = new Map([
      [A, listing(A, { unitPrice: 0.1 })],
      [B, listing(B, { unitPrice: 19.99, unitsAvailable: 64 })],
    ]);
    const result = priceCheckout(
      [
        { listingId: A, units: 3, expectedPriceCents: 10 },
        { listingId: B, units: 64, expectedPriceCents: 1999 },
      ],
      listings,
      BUYER,
    );
    expect(result).toEqual({
      ok: true,
      totalCents: 30 + 127936,
      lines: [
        { listingId: A, shopId: `shop-${A}`, quantity: 3, unitPrice: "0.10", total: "0.30", totalCents: 30 },
        { listingId: B, shopId: `shop-${B}`, quantity: 64, unitPrice: "19.99", total: "1279.36", totalCents: 127936 },
      ],
    });
  });

  it("reports every problem and creates nothing", () => {
    const listings = new Map([
      [A, listing(A, { unitsAvailable: 0 })],
      [B, listing(B, { unitsAvailable: 2 })],
      [C, listing(C, { unitPrice: 13 })],
    ]);
    const result = priceCheckout(
      [
        { listingId: A, units: 1, expectedPriceCents: 1250 },
        { listingId: B, units: 3, expectedPriceCents: 1250 },
        { listingId: C, units: 1, expectedPriceCents: 1250 },
        { listingId: uuid(9), units: 1, expectedPriceCents: 1250 },
      ],
      listings,
      BUYER,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        { listingId: A, reason: "sold_out" },
        { listingId: B, reason: "not_enough_stock", available: 2 },
        { listingId: C, reason: "price_changed", unitPrice: 13 },
        { listingId: uuid(9), reason: "unavailable" },
      ],
    });
  });

  it("does not let a seller buy from their own shop", () => {
    const listings = new Map([[A, listing(A, { shopOwnerUuid: BUYER.toUpperCase() })]]);
    const result = priceCheckout([{ listingId: A, units: 1, expectedPriceCents: 1250 }], listings, BUYER);
    expect(result).toEqual({ ok: false, problems: [{ listingId: A, reason: "own_shop" }] });
  });

  it("lets a player buy from their own shop only when allowOwnShop is set (dev)", () => {
    const listings = new Map([[A, listing(A, { shopOwnerUuid: BUYER })]]);
    const result = priceCheckout([{ listingId: A, units: 1, expectedPriceCents: 1250 }], listings, BUYER, {
      allowOwnShop: true,
    });
    expect(result.ok).toBe(true);
  });

  it("fails the whole checkout when one line fails", () => {
    const listings = new Map([[A, listing(A)]]);
    const result = priceCheckout(
      [
        { listingId: A, units: 1, expectedPriceCents: 1250 },
        { listingId: B, units: 1, expectedPriceCents: 1250 },
      ],
      listings,
      BUYER,
    );
    expect(result.ok).toBe(false);
  });
});
