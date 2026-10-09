import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isCategoryKey, type CategoryKey } from "@/lib/categories";
import { dbError, publicDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Public catalog (view public.catalog: active listings of approved shops, with stock, sales
 * and rating). Cached reads are tagged "catalog"; call updateTag("catalog") after a seller or
 * admin change. Stock also changes in the game, so cached reads expire after a minute.
 */

export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 24;

export type CatalogItem = {
  id: string;
  title: string;
  description: string;
  material: string;
  category: CategoryKey;
  unitAmount: number;
  unitPrice: number;
  pricePerItem: number;
  createdAt: string;
  shop: { id: string; slug: string; name: string; ink: string; official: boolean };
  unitsAvailable: number;
  unitsSold: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** Namespaced key of the item (minecraft:diamond, nexo:ruby…): what the deposit compares. */
  itemKey: string;
  /** KEY: any variant of the item; EXACT: only items identical to the shop's sample. */
  matchMode: "KEY" | "EXACT";
  /** Name and icon of a custom item (custom_items), when the listing sells one. */
  customName: string | null;
  customIconPath: string | null;
};

export type Locker = { id: string; name: string; world: string; x: number; y: number; z: number };

export type CatalogSort = "relevance" | "price_asc" | "price_desc" | "newest" | "best_selling" | "top_rated";

export type CatalogQuery = {
  q?: string;
  category?: CategoryKey | null;
  shopSlug?: string | null;
  inStock?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

type CatalogRow = Omit<Database["public"]["Views"]["catalog"]["Row"], "search_text" | "updated_at">;

const COLUMNS =
  "id, title, description, material, category, unit_amount, unit_price, price_per_item, created_at, shop_id, shop_slug, shop_name, shop_ink, shop_official, units_available, units_sold, rating_avg, rating_count, item_key, match_mode, custom_name, custom_icon_path";

function toItem(row: CatalogRow): CatalogItem {
  return {
    id: row.id!,
    title: row.title ?? "",
    description: row.description ?? "",
    material: row.material ?? "",
    category: isCategoryKey(row.category) ? row.category : "misc",
    unitAmount: row.unit_amount ?? 1,
    unitPrice: Number(row.unit_price ?? 0),
    pricePerItem: Number(row.price_per_item ?? 0),
    createdAt: row.created_at ?? "",
    shop: {
      id: row.shop_id!,
      slug: row.shop_slug ?? "",
      name: row.shop_name ?? "",
      ink: row.shop_ink ?? "grafito",
      official: row.shop_official ?? false,
    },
    unitsAvailable: row.units_available ?? 0,
    unitsSold: row.units_sold ?? 0,
    ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
    ratingCount: row.rating_count ?? 0,
    itemKey: row.item_key ?? `minecraft:${row.material ?? ""}`,
    matchMode: row.match_mode === "EXACT" ? "EXACT" : "KEY",
    customName: row.custom_name,
    customIconPath: row.custom_icon_path,
  };
}

/** Lowercase, no accents: matches catalog.search_text. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .trim();
}

export async function searchCatalog(query: CatalogQuery): Promise<{ items: CatalogItem[]; total: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const pageSize = query.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, query.page ?? 1);
  let request = publicDb().from("catalog").select(COLUMNS, { count: "exact" });

  for (const word of normalizeSearch(query.q ?? "").split(/\s+/).filter(Boolean).slice(0, 6)) {
    request = request.like("search_text", `%${word}%`);
  }
  if (query.category) request = request.eq("category", query.category);
  if (query.shopSlug) request = request.eq("shop_slug", query.shopSlug);
  if (query.inStock) request = request.gt("units_available", 0);
  if (query.minPrice != null) request = request.gte("unit_price", query.minPrice);
  if (query.maxPrice != null) request = request.lte("unit_price", query.maxPrice);

  switch (query.sort ?? "relevance") {
    case "price_asc":
      request = request.order("unit_price", { ascending: true });
      break;
    case "price_desc":
      request = request.order("unit_price", { ascending: false });
      break;
    case "newest":
      request = request.order("created_at", { ascending: false });
      break;
    case "best_selling":
      request = request.order("units_sold", { ascending: false });
      break;
    case "top_rated":
      request = request.order("rating_avg", { ascending: false, nullsFirst: false });
      break;
    default:
      // "Relevance": what can be bought now first, then what sells.
      request = request.order("units_available", { ascending: false }).order("units_sold", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await request.order("id").range(from, from + pageSize - 1);
  if (error) throw dbError(error);
  return { items: (data ?? []).map(toItem), total: count ?? 0 };
}

/** One public listing, or null if it is not (or no longer) in the catalog. */
export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG, `listing:${id}`);

  const { data, error } = await publicDb().from("catalog").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw dbError(error);
  return data ? toItem(data) : null;
}

/** Fresh (uncached) read for the cart and checkout: current price and stock. */
export async function getCatalogItemsFresh(ids: string[]): Promise<Map<string, CatalogItem>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await publicDb().from("catalog").select(COLUMNS).in("id", ids);
  if (error) throw dbError(error);
  return new Map((data ?? []).map((row) => [row.id!, toItem(row)]));
}

/** Uncached: the checkout must offer exactly the lockers that are active now. */
export async function getActiveLockersFresh(): Promise<Locker[]> {
  const { data, error } = await publicDb().from("lockers").select("id, name, world, x, y, z").order("name");
  if (error) throw dbError(error);
  return data ?? [];
}

export async function getActiveLockers(): Promise<Locker[]> {
  "use cache";
  // Lockers are created in the game, which cannot invalidate this tag: keep it short.
  cacheLife("minutes");
  cacheTag("lockers");

  const { data, error } = await publicDb().from("lockers").select("id, name, world, x, y, z").order("name");
  if (error) throw dbError(error);
  return data ?? [];
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Latest listings of the catalog (home page). */
export async function getNewestItems(limit = 10): Promise<CatalogItem[]> {
  const { items } = await searchCatalog({ sort: "newest", pageSize: limit });
  return items;
}

/** Listings with at least one sale, best sellers first (home page). */
export async function getBestSellers(limit = 10): Promise<CatalogItem[]> {
  const { items } = await searchCatalog({ sort: "best_selling", pageSize: limit });
  return items.filter((item) => item.unitsSold > 0);
}

/** Other listings of the same shop for the product page, without the one being shown. */
export async function getMoreFromShop(shopSlug: string, excludeId: string, limit = 5): Promise<CatalogItem[]> {
  const { items } = await searchCatalog({ shopSlug, sort: "relevance", pageSize: limit + 1 });
  return items.filter((item) => item.id !== excludeId).slice(0, limit);
}

export const CATALOG_SORTS: readonly CatalogSort[] = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
  "best_selling",
  "top_rated",
];

export function isCatalogSort(value: unknown): value is CatalogSort {
  return typeof value === "string" && (CATALOG_SORTS as readonly string[]).includes(value);
}
