import { describe, expect, it } from "vitest";
import {
  featuredInOrder,
  MAX_FEATURED_LISTINGS,
  pickFeatured,
  publicLocation,
  SHOP_TAGLINE_MAX,
  validateProfile,
} from "./profile";
import type { ShopZone } from "./storage";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];
const [a, b, c, d, e] = ids;

describe("pickFeatured", () => {
  it("keeps the active listings in the order they were picked, without repeats", () => {
    expect(pickFeatured([c, a, c], ids)).toEqual({ ids: [c, a], tooMany: false });
    expect(pickFeatured([A(a)], ids)).toEqual({ ids: [a], tooMany: false });
  });

  it("drops what is not an active listing of the shop", () => {
    const other = "99999999-9999-4999-8999-999999999999";
    expect(pickFeatured([a, other, "not-a-uuid", 42, null], [a, b])).toEqual({ ids: [a], tooMany: false });
    expect(pickFeatured([], ids)).toEqual({ ids: [], tooMany: false });
  });

  it("allows up to four", () => {
    expect(MAX_FEATURED_LISTINGS).toBe(4);
    expect(pickFeatured([a, b, c, d], ids)).toEqual({ ids: [a, b, c, d], tooMany: false });
    expect(pickFeatured([a, b, c, d, e], ids)).toEqual({ ids: [a, b, c, d], tooMany: true });
  });
});

describe("validateProfile", () => {
  it("cleans the tagline and reads the checkbox", () => {
    expect(validateProfile({ tagline: "  Picos   que no  se rompen ", featured: [b], showLocation: "on" }, ids)).toEqual({
      ok: true,
      value: { tagline: "Picos que no se rompen", featuredListingIds: [b], showLocation: true },
    });
    expect(validateProfile({ tagline: null, featured: [], showLocation: null }, ids)).toEqual({
      ok: true,
      value: { tagline: "", featuredListingIds: [], showLocation: false },
    });
  });

  it("limits the tagline to 80 characters as Postgres counts them", () => {
    expect(SHOP_TAGLINE_MAX).toBe(80);
    const ok = validateProfile({ tagline: "ñ".repeat(80), featured: [], showLocation: null }, ids);
    expect(ok.ok).toBe(true);
    const long = validateProfile({ tagline: "x".repeat(81), featured: [], showLocation: null }, ids);
    expect(long).toEqual({ ok: false, errors: { tagline: "taglineLength" } });
  });

  it("refuses more than four featured listings", () => {
    expect(validateProfile({ tagline: "", featured: ids, showLocation: "on" }, ids)).toEqual({
      ok: false,
      errors: { featured: "featuredTooMany" },
    });
  });
});

describe("featuredInOrder", () => {
  const shopId = "shop-1";
  const item = (id: string, shop = shopId) => ({ id, shop: { id: shop } });

  it("follows the seller's order and skips what left the catalog", () => {
    const items = new Map([
      [a, item(a)],
      [c, item(c)],
    ]);
    expect(featuredInOrder([c, b, a], items, shopId).map((x) => x.id)).toEqual([c, a]);
    expect(featuredInOrder([], items, shopId)).toEqual([]);
  });

  it("ignores listings of another shop", () => {
    const items = new Map([
      [a, item(a, "other-shop")],
      [b, item(b)],
    ]);
    expect(featuredInOrder([a, b], items, shopId).map((x) => x.id)).toEqual([b]);
  });
});

describe("publicLocation", () => {
  const zone: ShopZone = { world: "world", minX: 0, minY: 60, minZ: -10, maxX: 20, maxY: 80, maxZ: 10 };

  it("shows the zone only when the seller wants and it exists", () => {
    expect(publicLocation(true, zone)).toBe(zone);
    expect(publicLocation(false, zone)).toBeNull();
    expect(publicLocation(true, null)).toBeNull();
  });
});

/** Same uuid in capitals (forms may send any case). */
function A(id: string): string {
  return id.toUpperCase();
}
