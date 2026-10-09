import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, getCatalogItemsFresh, type CatalogItem } from "@/lib/data/catalog";
import { featuredInOrder, publicLocation } from "@/lib/seller/profile";
import { zoneFromColumns, type ShopZone } from "@/lib/seller/storage";
import { dbError, publicDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Public shop directory (view public.shop_directory: approved shops with their numbers) and the
 * storefront profile (public.shops: featured listings and location; public.shop_slug_history:
 * old slugs). Tagged "shops" (name, slug, profile, approval), "catalog" (listing, sales and
 * rating counts change with the catalog) and "shop:<slug>" for one storefront.
 */

export const SHOPS_TAG = "shops";

/** Tag of one storefront: update it with the old and the new slug when a slug changes. */
export function shopTag(slug: string): string {
  return `shop:${slug}`;
}

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  ink: string;
  official: boolean;
  createdAt: string;
  ownerName: string;
  listingCount: number;
  unitsSold: number;
  ratingAvg: number | null;
  ratingCount: number;
  tagline: string;
  /** Paths in the shop-media bucket (shopMediaUrl() gives the URL), or null. */
  logoPath: string | null;
  bannerPath: string | null;
};

/** A storefront: the directory data plus the profile kept in public.shops. */
export type ShopDetails = ShopSummary & {
  featuredListingIds: string[];
  /** Zone in the game, only when the seller chose to show it and an admin set one. */
  location: ShopZone | null;
};

type ShopRow = Database["public"]["Views"]["shop_directory"]["Row"];

const COLUMNS =
  "id, slug, name, description, ink, official, created_at, owner_name, listing_count, units_sold, rating_avg, rating_count, tagline, logo_path, banner_path";

const PROFILE_COLUMNS =
  "featured_listing_ids, show_location, zone_world, zone_min_x, zone_min_y, zone_min_z, zone_max_x, zone_max_y, zone_max_z";

/** Lowercase words joined by hyphens, as public.shops.slug requires. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isShopSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 60 && SLUG_PATTERN.test(value);
}

function toShop(row: ShopRow): ShopSummary {
  return {
    id: row.id!,
    slug: row.slug ?? "",
    name: row.name ?? "",
    description: row.description ?? "",
    ink: row.ink ?? "grafito",
    official: row.official ?? false,
    createdAt: row.created_at ?? "",
    ownerName: row.owner_name ?? "",
    listingCount: row.listing_count ?? 0,
    unitsSold: row.units_sold ?? 0,
    ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
    ratingCount: row.rating_count ?? 0,
    tagline: row.tagline ?? "",
    logoPath: row.logo_path ?? null,
    bannerPath: row.banner_path ?? null,
  };
}

/** Every approved shop: official first, then the ones that sell the most. */
export async function getShopDirectory(): Promise<ShopSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SHOPS_TAG, CATALOG_TAG);

  const { data, error } = await publicDb()
    .from("shop_directory")
    .select(COLUMNS)
    .order("official", { ascending: false })
    .order("units_sold", { ascending: false })
    .order("listing_count", { ascending: false })
    .order("name");
  if (error) throw dbError(error);
  return (data ?? []).map(toShop);
}

/** The first shops of the directory (home page). */
export async function getTopShops(limit = 6): Promise<ShopSummary[]> {
  const shops = await getShopDirectory();
  return shops.slice(0, limit);
}

/** An approved shop by its current slug, or null (unknown, old slug, pending, rejected or suspended). */
export async function getShopBySlug(slug: string): Promise<ShopDetails | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SHOPS_TAG, CATALOG_TAG, shopTag(slug));

  if (!isShopSlug(slug)) return null;
  const [directory, profile] = await Promise.all([
    publicDb().from("shop_directory").select(COLUMNS).eq("slug", slug).maybeSingle(),
    // RLS: only approved shops are readable with the publishable key.
    publicDb().from("shops").select(PROFILE_COLUMNS).eq("slug", slug).maybeSingle(),
  ]);
  if (directory.error) throw dbError(directory.error);
  if (profile.error) throw dbError(profile.error);
  if (!directory.data) return null;
  return {
    ...toShop(directory.data),
    featuredListingIds: profile.data?.featured_listing_ids ?? [],
    location: profile.data ? publicLocation(profile.data.show_location, zoneFromColumns(profile.data)) : null,
  };
}

/**
 * Current slug of an approved shop that used `slug` before (public.shop_slug_history), so old
 * links redirect. Null when the slug never belonged to an approved shop.
 */
export async function getRenamedShopSlug(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SHOPS_TAG, shopTag(slug));

  if (!isShopSlug(slug)) return null;
  const history = await publicDb().from("shop_slug_history").select("shop_id").eq("slug", slug).maybeSingle();
  if (history.error) throw dbError(history.error);
  if (!history.data) return null;

  const shop = await publicDb()
    .from("shops")
    .select("slug")
    .eq("id", history.data.shop_id)
    .eq("status", "APPROVED")
    .maybeSingle();
  if (shop.error) throw dbError(shop.error);
  return shop.data && shop.data.slug !== slug ? shop.data.slug : null;
}

/** The shop's featured listings that are still in the catalog, in the seller's order. */
export async function getFeaturedItems(shopId: string, listingIds: string[]): Promise<CatalogItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG, SHOPS_TAG);

  if (listingIds.length === 0) return [];
  const items = await getCatalogItemsFresh(listingIds);
  return featuredInOrder(listingIds, items, shopId);
}
