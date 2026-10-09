import { describe, expect, it } from "vitest";
import {
  canEditShop,
  canRemoveListing,
  filterStatuses,
  isListingFormatLocked,
  isLowStock,
  summarizeOrders,
  summarizeOrdersByShop,
  type OrderFigures,
} from "./stats";

describe("summarizeOrders", () => {
  const rows: OrderFigures[] = [
    { listing_id: "a", quantity: 2, total: "20.10", status: "PAID" },
    { listing_id: "a", quantity: 1, total: 10.05, status: "COLLECTED" },
    { listing_id: "a", quantity: 5, total: "50.00", status: "PENDING" },
    { listing_id: "b", quantity: 3, total: "0.30", status: "READY" },
    { listing_id: "b", quantity: 4, total: "4.00", status: "FAILED" },
    { listing_id: "c", quantity: 1, total: "1.00", status: "REFUNDED" },
  ];

  it("adds up sold units, revenue in cents and open orders", () => {
    const summary = summarizeOrders(rows);
    expect(summary.unitsSold).toBe(6);
    expect(summary.revenueCents).toBe(3045);
    expect(summary.openOrders).toBe(3);
  });

  it("breaks the figures down by listing", () => {
    const { byListing } = summarizeOrders(rows);
    expect(byListing.get("a")).toEqual({ unitsSold: 3, openOrders: 2 });
    expect(byListing.get("b")).toEqual({ unitsSold: 3, openOrders: 1 });
    expect(byListing.get("c")).toEqual({ unitsSold: 0, openOrders: 0 });
  });

  it("handles no orders", () => {
    expect(summarizeOrders([])).toEqual({ unitsSold: 0, revenueCents: 0, openOrders: 0, byListing: new Map() });
  });
});

describe("summarizeOrdersByShop", () => {
  it("keeps the figures of each shop apart", () => {
    const byShop = summarizeOrdersByShop([
      { shop_id: "s1", listing_id: "a", quantity: 2, total: "20.00", status: "PAID" },
      { shop_id: "s2", listing_id: "b", quantity: 1, total: "5.50", status: "COLLECTED" },
      { shop_id: "s1", listing_id: "a", quantity: 1, total: "10.00", status: "PENDING" },
    ]);
    // A PAID order is both sold and still open (waiting for the locker).
    expect(byShop.get("s1")).toMatchObject({ unitsSold: 2, revenueCents: 2000, openOrders: 2 });
    expect(byShop.get("s2")).toMatchObject({ unitsSold: 1, revenueCents: 550, openOrders: 0 });
  });

  it("gives empty figures to the listed shops without orders", () => {
    const byShop = summarizeOrdersByShop([], ["s1"]);
    expect(byShop.get("s1")).toEqual({ unitsSold: 0, revenueCents: 0, openOrders: 0, byListing: new Map() });
    expect(byShop.has("s2")).toBe(false);
  });
});

describe("filterStatuses", () => {
  it("maps filters to order statuses", () => {
    expect(filterStatuses("all")).toBeNull();
    expect(filterStatuses("open")).toEqual(["PENDING", "PAID", "READY"]);
    expect(filterStatuses("READY")).toEqual(["READY"]);
  });
});

describe("listing rules", () => {
  const empty = { available: 0, reserved: 0, delivered: 0, returned: 0 };

  it("removes a listing only when nothing is held or waiting", () => {
    expect(canRemoveListing({ status: "PAUSED", available: 0, reserved: 0, openOrders: 0 })).toBe(true);
    expect(canRemoveListing({ status: "ACTIVE", available: 1, reserved: 0, openOrders: 0 })).toBe(false);
    expect(canRemoveListing({ status: "ACTIVE", available: 0, reserved: 1, openOrders: 0 })).toBe(false);
    expect(canRemoveListing({ status: "ACTIVE", available: 0, reserved: 0, openOrders: 1 })).toBe(false);
    expect(canRemoveListing({ status: "REMOVED", available: 0, reserved: 0, openOrders: 0 })).toBe(false);
  });

  it("locks the format once anything was deposited", () => {
    expect(isListingFormatLocked(empty)).toBe(false);
    expect(isListingFormatLocked({ ...empty, delivered: 1 })).toBe(true);
    expect(isListingFormatLocked({ ...empty, returned: 1 })).toBe(true);
  });

  it("flags active listings that are running out", () => {
    expect(isLowStock({ status: "ACTIVE", available: 3 })).toBe(true);
    expect(isLowStock({ status: "ACTIVE", available: 4 })).toBe(false);
    expect(isLowStock({ status: "PAUSED", available: 0 })).toBe(false);
  });
});

describe("shop rules", () => {
  it("freezes suspended shops only", () => {
    expect(canEditShop("SUSPENDED")).toBe(false);
    expect(canEditShop("REJECTED")).toBe(true);
    expect(canEditShop("PENDING")).toBe(true);
    expect(canEditShop("APPROVED")).toBe(true);
  });
});
