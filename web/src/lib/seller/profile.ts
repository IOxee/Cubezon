import type { ShopZone } from "./storage";
import { charLength, cleanLine, type FieldErrors, type Result } from "./validation";

/**
 * Pure rules of a shop's public profile: tagline, featured listings and whether the storefront
 * shows where the shop is in the game. Mirrors the CHECK constraints of public.shops.
 */

export const SHOP_TAGLINE_MAX = 80;
export const MAX_FEATURED_LISTINGS = 4;

export type ProfileField = "tagline" | "featured";

export type ProfileInput = { tagline: string; featuredListingIds: string[]; showLocation: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Featured listings picked in the form: only the shop's ACTIVE listings count (others are
 * dropped: they may have been paused since the page loaded), without repeats, in the order
 * they were picked. tooMany when more than MAX_FEATURED_LISTINGS valid ones were sent.
 */
export function pickFeatured(
  selected: readonly unknown[],
  activeListingIds: readonly string[],
): { ids: string[]; tooMany: boolean } {
  const active = new Set(activeListingIds.map((id) => id.toLowerCase()));
  const ids: string[] = [];
  for (const value of selected) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) continue;
    const id = value.toLowerCase();
    if (active.has(id) && !ids.includes(id)) ids.push(id);
  }
  return { ids: ids.slice(0, MAX_FEATURED_LISTINGS), tooMany: ids.length > MAX_FEATURED_LISTINGS };
}

/** A checkbox sends "on" when checked and nothing otherwise. */
function isChecked(value: unknown): boolean {
  return value === "on" || value === "true" || value === true;
}

export function validateProfile(
  raw: { tagline: unknown; featured: readonly unknown[]; showLocation: unknown },
  activeListingIds: readonly string[],
): Result<ProfileInput, ProfileField> {
  const errors: FieldErrors<ProfileField> = {};

  const tagline = cleanLine(raw.tagline);
  if (charLength(tagline) > SHOP_TAGLINE_MAX) errors.tagline = "taglineLength";

  const featured = pickFeatured(raw.featured, activeListingIds);
  if (featured.tooMany) errors.featured = "featuredTooMany";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { tagline, featuredListingIds: featured.ids, showLocation: isChecked(raw.showLocation) } };
}

/**
 * The featured listings that are still in the catalog, in the order the seller chose them.
 * Listings of another shop are ignored (never expected, but the ids come from a column).
 */
export function featuredInOrder<T extends { id: string; shop: { id: string } }>(
  featuredIds: readonly string[],
  items: ReadonlyMap<string, T>,
  shopId: string,
): T[] {
  const result: T[] = [];
  for (const id of featuredIds.slice(0, MAX_FEATURED_LISTINGS)) {
    const item = items.get(id);
    if (item && item.shop.id === shopId && !result.includes(item)) result.push(item);
  }
  return result;
}

/** Zone shown on the storefront: only if the seller chose to show it and an admin set one. */
export function publicLocation(showLocation: boolean, zone: ShopZone | null): ShopZone | null {
  return showLocation ? zone : null;
}
