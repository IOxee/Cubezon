import { describe, expect, it } from "vitest";
import {
  canRequestShop,
  countsTowardShopLimit,
  isOverShopSlots,
  isShopSlotsExceeded,
  panelPath,
  parseShopSlotsInput,
  resolveShopSlots,
} from "./shops";

describe("shop slots", () => {
  it("counts every shop except the rejected ones", () => {
    expect(countsTowardShopLimit("PENDING")).toBe(true);
    expect(countsTowardShopLimit("APPROVED")).toBe(true);
    expect(countsTowardShopLimit("SUSPENDED")).toBe(true);
    expect(countsTowardShopLimit("REJECTED")).toBe(false);
  });

  it("uses the player's own slots, or the default ones when they have none", () => {
    expect(resolveShopSlots(null, 1, 0)).toEqual({ slots: 1, used: 0, free: 1, custom: false });
    expect(resolveShopSlots(2, 1, 1)).toEqual({ slots: 2, used: 1, free: 1, custom: true });
    // Zero is a real value (no shops at all), not "use the default".
    expect(resolveShopSlots(0, 3, 0)).toEqual({ slots: 0, used: 0, free: 0, custom: true });
  });

  it("never has negative free slots when an admin lowered them below the shops in use", () => {
    const slots = resolveShopSlots(1, 5, 3);
    expect(slots.free).toBe(0);
    expect(isOverShopSlots(slots)).toBe(true);
    expect(isOverShopSlots(resolveShopSlots(3, 5, 3))).toBe(false);
  });

  it("lets a player request (or send back) a shop only with a free slot", () => {
    expect(canRequestShop({ free: 1 })).toBe(true);
    expect(canRequestShop({ free: 0 })).toBe(false);
    expect(canRequestShop(resolveShopSlots(null, 1, 1))).toBe(false);
    expect(canRequestShop(resolveShopSlots(2, 1, 1))).toBe(true);
  });
});

describe("parseShopSlotsInput", () => {
  it("accepts whole numbers from 0 to 100", () => {
    expect(parseShopSlotsInput("0")).toBe(0);
    expect(parseShopSlotsInput(" 7 ")).toBe(7);
    expect(parseShopSlotsInput("100")).toBe(100);
  });

  it("turns reset into null (the default slots)", () => {
    expect(parseShopSlotsInput("reset")).toBeNull();
  });

  it("rejects anything else", () => {
    for (const value of ["", "-1", "101", "2.5", "1e2", "abc", "007a", "1000"]) {
      expect(parseShopSlotsInput(value)).toBeUndefined();
    }
    expect(parseShopSlotsInput(null)).toBeUndefined();
    expect(parseShopSlotsInput(5)).toBeUndefined();
  });
});

describe("isShopSlotsExceeded", () => {
  it("recognises the error of the shops_check_slots trigger", () => {
    expect(isShopSlotsExceeded({ code: "23514", message: "SHOP_SLOTS_EXCEEDED: 1 of 1 shop slots used" })).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isShopSlotsExceeded({ code: "23514", message: 'new row violates check constraint "shops_slug_check"' })).toBe(false);
    expect(isShopSlotsExceeded({ code: "23505", message: "SHOP_SLOTS_EXCEEDED" })).toBe(false);
    expect(isShopSlotsExceeded(null)).toBe(false);
    expect(isShopSlotsExceeded(undefined)).toBe(false);
  });
});

describe("panelPath", () => {
  it("builds the panel URL of a shop", () => {
    expect(panelPath("minas-paco")).toBe("/panel/minas-paco");
    expect(panelPath("minas-paco", "products", "new")).toBe("/panel/minas-paco/products/new");
  });

  it("skips empty segments and encodes each one", () => {
    expect(panelPath("minas-paco", "")).toBe("/panel/minas-paco");
    expect(panelPath("a/b", "x y")).toBe("/panel/a%2Fb/x%20y");
  });
});
