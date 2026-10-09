import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { requirePlayer, type Player } from "@/lib/auth/session";
import { fromCents } from "@/lib/format";
import { getShopPermissions } from "@/lib/data/shop-roles";
import {
  OPEN_STATUSES,
  summarizeOrders,
  summarizeOrdersByShop,
  type ListingStatus,
  type OrderFigures,
  type OrderStatus,
  type SalesSummary,
  type ShopStatus,
} from "@/lib/seller/stats";
import { parseDeliveryMethod, type DeliveryMethod } from "@/lib/delivery";
import { SHOP_PERMISSIONS, type ShopPermission, type StaffActor } from "@/lib/seller/permissions";
import { isShopSlotsExceeded } from "@/lib/seller/shops";
import { EMPTY_STORAGE, zoneFromColumns, type ShopZone, type StorageFigures } from "@/lib/seller/storage";
import { isValidSlug, type ListingInput, type ShopInput } from "@/lib/seller/validation";
import { SHOP_MEDIA_BUCKET, type ShopMediaKind } from "@/lib/shop-media";
import { adminDb, dbError } from "@/lib/supabase/server";

/**
 * Seller area: the player's own shops (a player can have several), their listings, stock,
 * storage and orders. Everything here uses the secret key, so call it only after requirePlayer()
 * and always with one of the player's own shops: requireSellerShop() loads it by slug AND owner.
 * Reads are private and uncached: stock changes in the game.
 */

const UNIQUE_VIOLATION = "23505";

export type SellerShop = {
  id: string;
  /** Mojang UUID of the owner (players.uuid). */
  ownerUuid: string;
  name: string;
  slug: string;
  description: string;
  ink: string;
  status: ShopStatus;
  official: boolean;
  reviewNote: string | null;
  /** Cuboid in the game where its storage blocks count; null until an admin sets it. */
  zone: ShopZone | null;
  /** Public profile: one-line tagline, images in the shop-media bucket, featured listings. */
  tagline: string;
  logoPath: string | null;
  bannerPath: string | null;
  featuredListingIds: string[];
  /** Whether the storefront shows the zone (only if there is one). */
  showLocation: boolean;
};

export type Inventory = { available: number; reserved: number; delivered: number; returned: number };

export type SellerListing = Inventory & {
  id: string;
  title: string;
  description: string;
  material: string;
  /** What the deposit compares: minecraft:<material> or the key of a custom item. */
  itemKey: string;
  unitAmount: number;
  unitPrice: number;
  status: ListingStatus;
  createdAt: string;
};

export type SellerOrder = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  processingStartedAt: string | null;
  /** Code set by the plugin on FAILED/REFUNDED orders (SHOP_REJECTED and EXPIRED read "Cancelado"). */
  failureReason: string | null;
  /** LOCKER, or MAILBOX: express to the buyer's mailbox (no package, no locker). */
  delivery: DeliveryMethod;
  /** When the seller got the money (orders.seller_paid_at); in roleplay mode, on delivery. */
  sellerPaidAt: string | null;
  quantity: number;
  total: number;
  buyerName: string | null;
  listing: { id: string; title: string; material: string; unitAmount: number } | null;
  lockerName: string | null;
};

/** Figures of a shop card in "Mis tiendas": its sales plus the units available to sell. */
export type ShopKpis = SalesSummary & { stock: number };

const EMPTY_INVENTORY: Inventory = { available: 0, reserved: 0, delivered: 0, returned: 0 };

// Shops

const SHOP_COLUMNS =
  "id, owner_uuid, name, slug, description, ink, status, official, review_note, zone_world, zone_min_x, zone_min_y, zone_min_z, zone_max_x, zone_max_y, zone_max_z, tagline, logo_path, banner_path, featured_listing_ids, show_location";

type ShopRow = {
  id: string;
  owner_uuid: string;
  name: string;
  slug: string;
  description: string;
  ink: string;
  status: ShopStatus;
  official: boolean;
  review_note: string | null;
  zone_world: string | null;
  zone_min_x: number | null;
  zone_min_y: number | null;
  zone_min_z: number | null;
  zone_max_x: number | null;
  zone_max_y: number | null;
  zone_max_z: number | null;
  tagline: string;
  logo_path: string | null;
  banner_path: string | null;
  featured_listing_ids: string[];
  show_location: boolean;
};

function toShop(row: ShopRow): SellerShop {
  return {
    id: row.id,
    ownerUuid: row.owner_uuid,
    name: row.name,
    slug: row.slug,
    description: row.description,
    ink: row.ink,
    status: row.status,
    official: row.official,
    reviewNote: row.review_note,
    zone: zoneFromColumns(row),
    tagline: row.tagline,
    logoPath: row.logo_path,
    bannerPath: row.banner_path,
    featuredListingIds: row.featured_listing_ids,
    showLocation: row.show_location,
  };
}

/** Every shop of the player (any status), oldest first. Deduplicated per request. */
export const getOwnShops = cache(async (ownerUuid: string): Promise<SellerShop[]> => {
  const { data, error } = await adminDb()
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("owner_uuid", ownerUuid)
    .order("created_at", { ascending: true })
    .order("id");
  if (error) throw dbError(error);
  return data.map(toShop);
});

/** One shop of the player by slug, or null if it does not exist or is someone else's. */
export const getOwnShopBySlug = cache(async (ownerUuid: string, slug: string): Promise<SellerShop | null> => {
  if (!isValidSlug(slug)) return null;
  const { data, error } = await adminDb()
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("slug", slug)
    .eq("owner_uuid", ownerUuid)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toShop(data) : null;
});

/** What the player is in a shop's panel: its owner, or an employee (shop_members). */
export type PanelRole = "owner" | "employee";

/** `roleName`: the employee's rank in that shop (shop_roles), null for the owner. */
export type PanelShop = SellerShop & { role: PanelRole; roleName: string | null };

/** Shops where the player is an employee, with their rank in each. */
const getEmployments = cache(async (playerUuid: string): Promise<Map<string, string | null>> => {
  const { data, error } = await adminDb()
    .from("shop_members")
    .select("shop_id, role:shop_roles(name)")
    .eq("player_uuid", playerUuid);
  if (error) throw dbError(error);
  return new Map(data.map((row) => [row.shop_id, row.role?.name ?? null]));
});

/**
 * Shops whose panel the player can open: the ones they own and the ones they work for, owned
 * first. Deduplicated per request.
 */
export const getPanelShops = cache(async (playerUuid: string): Promise<PanelShop[]> => {
  const [owned, employments] = await Promise.all([getOwnShops(playerUuid), getEmployments(playerUuid)]);
  const ownedIds = new Set(owned.map((shop) => shop.id));
  const otherIds = [...employments.keys()].filter((id) => !ownedIds.has(id));
  let employed: SellerShop[] = [];
  if (otherIds.length > 0) {
    const { data, error } = await adminDb()
      .from("shops")
      .select(SHOP_COLUMNS)
      .in("id", otherIds)
      .order("created_at", { ascending: true })
      .order("id");
    if (error) throw dbError(error);
    employed = data.map(toShop);
  }
  return [
    ...owned.map((shop) => ({ ...shop, role: "owner" as const, roleName: null })),
    ...employed.map((shop) => ({ ...shop, role: "employee" as const, roleName: employments.get(shop.id) ?? null })),
  ];
});

/** A shop by slug if the player owns it or works for it, with their role; otherwise null. */
export const getPanelShopBySlug = cache(async (playerUuid: string, slug: string): Promise<PanelShop | null> => {
  if (!isValidSlug(slug)) return null;
  const { data, error } = await adminDb()
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;
  if (data.owner_uuid === playerUuid) return { ...toShop(data), role: "owner", roleName: null };
  const employments = await getEmployments(playerUuid);
  return employments.has(data.id) ? { ...toShop(data), role: "employee", roleName: employments.get(data.id) ?? null } : null;
});

/** A panel shop plus what the player may do in it (every permission for the owner). */
export type PanelAccess = PanelShop & { permissions: ShopPermission[] };

/** The shop and the player's permissions in it (null when it is not one of their shops). */
export async function getPanelAccess(playerUuid: string, slug: string): Promise<PanelAccess | null> {
  const shop = await getPanelShopBySlug(playerUuid, slug);
  if (!shop) return null;
  const permissions = shop.role === "owner" ? [...SHOP_PERMISSIONS] : ((await getShopPermissions(shop.id, playerUuid)) ?? []);
  return { ...shop, permissions };
}

/**
 * For the pages and actions of /panel/[tienda]: the logged-in player (or off to sign in) and the
 * shop with that slug, if they own it or are one of its employees, with their permissions there
 * (shop_permissions_of). Anything else is a 404. `ownerOnly` (shop settings, public profile,
 * ranks) also 404s for employees, and `permission` for employees whose rank lacks it.
 */
export async function requireSellerShop(
  slug: string,
  nextPath: string,
  { ownerOnly = false, permission }: { ownerOnly?: boolean; permission?: ShopPermission } = {},
): Promise<{ player: Player; shop: PanelAccess }> {
  const player = await requirePlayer(nextPath);
  const shop = await getPanelAccess(player.uuid, slug);
  if (!shop || (ownerOnly && shop.role !== "owner")) notFound();
  if (permission && !shop.permissions.includes(permission)) notFound();
  return { player, shop };
}

/** The actor for the rank rules of lib/seller/permissions. */
export function staffActor(shop: PanelAccess): StaffActor {
  return { isOwner: shop.role === "owner", permissions: shop.permissions };
}

export async function isSlugTaken(slug: string, exceptShopId?: string): Promise<boolean> {
  let query = adminDb().from("shops").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptShopId) query = query.neq("id", exceptShopId);
  const { count, error } = await query;
  if (error) throw dbError(error);
  return (count ?? 0) > 0;
}

type ShopWrite = "ok" | "slugTaken" | "conflict";

/** A request also fails with "slotsExceeded" when the shops_check_slots trigger finds no free slot. */
type ShopRequestWrite = ShopWrite | "slotsExceeded";

/** New shop request: always PENDING until an admin reviews it. Slugs are unique across shops. */
export async function createShop(ownerUuid: string, input: ShopInput): Promise<ShopRequestWrite> {
  const { error } = await adminDb().from("shops").insert({
    owner_uuid: ownerUuid,
    name: input.name,
    slug: input.slug,
    description: input.description,
    ink: input.ink,
    status: "PENDING",
  });
  if (error?.code === UNIQUE_VIOLATION) return "slugTaken";
  if (isShopSlotsExceeded(error)) return "slotsExceeded";
  if (error) throw dbError(error);
  return "ok";
}

/**
 * Corrected request of one of the player's REJECTED shops: back to PENDING, previous review
 * cleared. "conflict" when the shop is not theirs or is no longer rejected.
 */
export async function resubmitShop(ownerUuid: string, shopId: string, input: ShopInput): Promise<ShopRequestWrite> {
  const { data, error } = await adminDb()
    .from("shops")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description,
      ink: input.ink,
      status: "PENDING",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", shopId)
    .eq("owner_uuid", ownerUuid)
    .eq("status", "REJECTED")
    .select("id");
  if (error?.code === UNIQUE_VIOLATION) return "slugTaken";
  if (isShopSlotsExceeded(error)) return "slotsExceeded";
  if (error) throw dbError(error);
  return data.length > 0 ? "ok" : "conflict";
}

/**
 * Edits from the panel, in any status but SUSPENDED and without a new review. A trigger keeps
 * the old slug in shop_slug_history (old links redirect) and raises a unique violation, like a
 * slug in use, when the slug belonged to another shop: both come back as "slugTaken".
 */
export async function updateShopDetails(
  shopId: string,
  patch: { description: string; ink: string; name?: string; slug?: string },
): Promise<ShopWrite> {
  const { error } = await adminDb().from("shops").update(patch).eq("id", shopId);
  if (error?.code === UNIQUE_VIOLATION) return "slugTaken";
  if (error) throw dbError(error);
  return "ok";
}

/** Public profile from the panel: tagline, featured listings (already checked) and location. */
export async function updateShopProfile(
  shopId: string,
  profile: { tagline: string; featuredListingIds: string[]; showLocation: boolean },
): Promise<void> {
  const { error } = await adminDb()
    .from("shops")
    .update({
      tagline: profile.tagline,
      featured_listing_ids: profile.featuredListingIds,
      show_location: profile.showLocation,
    })
    .eq("id", shopId);
  if (error) throw dbError(error);
}

/**
 * Points the shop's logo or banner to another object of the shop-media bucket (null removes
 * it), only while it still points to `previous`: false if another upload changed it meanwhile.
 */
export async function replaceShopImage(
  shopId: string,
  kind: ShopMediaKind,
  previous: string | null,
  next: string | null,
): Promise<boolean> {
  const column = kind === "logo" ? "logo_path" : "banner_path";
  let query = adminDb()
    .from("shops")
    .update(kind === "logo" ? { logo_path: next } : { banner_path: next })
    .eq("id", shopId);
  query = previous === null ? query.is(column, null) : query.eq(column, previous);
  const { data, error } = await query.select("id");
  if (error) throw dbError(error);
  return data.length > 0;
}

/** Uploads a checked image (validateShopImage) to the public bucket. Paths are never reused. */
export async function uploadShopMedia(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await adminDb()
    .storage.from(SHOP_MEDIA_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw dbError(error);
}

export async function deleteShopMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await adminDb().storage.from(SHOP_MEDIA_BUCKET).remove(paths);
  if (error) throw dbError(error);
}

// Storage (private view shop_storage: blocks placed in the zone, capacity and units in use)

/** Storage of the given shops (all of them the player's), keyed by shop id. */
export async function getShopsStorage(shopIds: string[]): Promise<Map<string, StorageFigures>> {
  if (shopIds.length === 0) return new Map();
  const { data, error } = await adminDb()
    .from("shop_storage")
    .select("shop_id, storage_blocks, capacity_units, used_units")
    .in("shop_id", shopIds);
  if (error) throw dbError(error);
  const storage = new Map<string, StorageFigures>(shopIds.map((id) => [id, EMPTY_STORAGE]));
  for (const row of data) {
    if (!row.shop_id) continue;
    storage.set(row.shop_id, {
      blocks: row.storage_blocks ?? 0,
      capacity: row.capacity_units ?? 0,
      used: row.used_units ?? 0,
    });
  }
  return storage;
}

export async function getShopStorage(shopId: string): Promise<StorageFigures> {
  return (await getShopsStorage([shopId])).get(shopId) ?? EMPTY_STORAGE;
}

// Listings and stock

const LISTING_COLUMNS = "id, title, description, material, item_key, unit_amount, unit_price, status, created_at";

type ListingRow = {
  id: string;
  title: string;
  description: string;
  material: string;
  item_key: string;
  unit_amount: number;
  unit_price: number;
  status: ListingStatus;
  created_at: string;
};

function toListing(row: ListingRow, inventory: Inventory | undefined): SellerListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    material: row.material,
    itemKey: row.item_key,
    unitAmount: row.unit_amount,
    unitPrice: Number(row.unit_price),
    status: row.status,
    createdAt: row.created_at,
    ...(inventory ?? EMPTY_INVENTORY),
  };
}

/** Listing ids per request to listing_inventory (they go in the URL of the query). */
const INVENTORY_CHUNK = 100;

/** Escrow units per status (view listing_inventory) for the given listings. */
async function getInventory(listingIds: string[]): Promise<Map<string, Inventory>> {
  const chunks: string[][] = [];
  for (let from = 0; from < listingIds.length; from += INVENTORY_CHUNK) {
    chunks.push(listingIds.slice(from, from + INVENTORY_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((ids) =>
      adminDb().from("listing_inventory").select("listing_id, available, reserved, delivered, returned").in("listing_id", ids),
    ),
  );
  const inventory = new Map<string, Inventory>();
  for (const { data, error } of results) {
    if (error) throw dbError(error);
    for (const row of data) {
      if (!row.listing_id) continue;
      inventory.set(row.listing_id, {
        available: row.available ?? 0,
        reserved: row.reserved ?? 0,
        delivered: row.delivered ?? 0,
        returned: row.returned ?? 0,
      });
    }
  }
  return inventory;
}

/** Every listing of the shop with its stock, newest first. */
export async function getShopListings(shopId: string): Promise<SellerListing[]> {
  const { data, error } = await adminDb()
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) throw dbError(error);
  const inventory = await getInventory(data.map((row) => row.id));
  return data.map((row) => toListing(row, inventory.get(row.id)));
}

/** One listing of the shop with its stock, or null if it does not exist or is someone else's. */
export async function getShopListing(shopId: string, listingId: string): Promise<SellerListing | null> {
  const { data, error } = await adminDb()
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", listingId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;
  const inventory = await getInventory([data.id]);
  return toListing(data, inventory.get(data.id));
}

export async function createListing(shopId: string, input: ListingInput): Promise<string> {
  // A new listing always has a format (it is only null when an edit keeps the stored one).
  if (!input.format) throw new Error("createListing needs the item and the items per unit");
  const { data, error } = await adminDb()
    .from("listings")
    .insert({
      shop_id: shopId,
      title: input.title,
      description: input.description,
      material: input.format.material,
      item_key: input.format.itemKey,
      unit_amount: input.format.unitAmount,
      unit_price: fromCents(input.priceCents),
      status: input.status,
    })
    .select("id")
    .single();
  if (error) throw dbError(error);
  return data.id;
}

/**
 * Updates a listing of the shop (never a REMOVED one). Without `input.format` (locked: units were
 * deposited), item_key, material and unit_amount are left as they are.
 */
export async function updateListing(shopId: string, listingId: string, input: ListingInput): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("listings")
    .update({
      title: input.title,
      description: input.description,
      unit_price: fromCents(input.priceCents),
      status: input.status,
      ...(input.format
        ? { material: input.format.material, item_key: input.format.itemKey, unit_amount: input.format.unitAmount }
        : {}),
    })
    .eq("id", listingId)
    .eq("shop_id", shopId)
    .neq("status", "REMOVED")
    .select("id");
  if (error) throw dbError(error);
  return data.length > 0;
}

export async function setListingStatus(shopId: string, listingId: string, status: ListingStatus): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .eq("shop_id", shopId)
    .neq("status", "REMOVED")
    .select("id");
  if (error) throw dbError(error);
  return data.length > 0;
}

/**
 * Brings a REMOVED listing back, paused (removing only changes the status: the plugin never
 * touches its units). The seller reviews it and activates it to sell it again.
 */
export async function restoreListing(shopId: string, listingId: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("listings")
    .update({ status: "PAUSED" })
    .eq("id", listingId)
    .eq("shop_id", shopId)
    .eq("status", "REMOVED")
    .select("id");
  if (error) throw dbError(error);
  return data.length > 0;
}

// Orders and sales

const SALES_PAGE = 1000;
const SALES_MAX_PAGES = 50;

/**
 * Order rows (figures only) of the given shops. Adds them up here because PostgREST aggregates
 * are off; a SQL view would be the next step at scale.
 */
async function getOrderFigures(shopIds: string[]): Promise<(OrderFigures & { shop_id: string })[]> {
  const rows: (OrderFigures & { shop_id: string })[] = [];
  if (shopIds.length === 0) return rows;
  for (let page = 0; page < SALES_MAX_PAGES; page++) {
    const from = page * SALES_PAGE;
    const { data, error } = await adminDb()
      .from("orders")
      .select("shop_id, listing_id, quantity, total, status")
      .in("shop_id", shopIds)
      .order("id")
      .range(from, from + SALES_PAGE - 1);
    if (error) throw dbError(error);
    rows.push(...data);
    if (data.length < SALES_PAGE) break;
  }
  return rows;
}

/** Sales figures of the shop (sold units, revenue, open orders, per listing). */
export async function getShopSales(shopId: string): Promise<SalesSummary> {
  return summarizeOrders(await getOrderFigures([shopId]));
}

/** Sales and available stock of several shops of the player (the "Mis tiendas" cards). */
export async function getShopsKpis(shopIds: string[]): Promise<Map<string, ShopKpis>> {
  if (shopIds.length === 0) return new Map();
  const [orders, listings] = await Promise.all([
    getOrderFigures(shopIds),
    adminDb().from("listings").select("id, shop_id").in("shop_id", shopIds).neq("status", "REMOVED"),
  ]);
  if (listings.error) throw dbError(listings.error);
  const inventory = await getInventory(listings.data.map((row) => row.id));

  const stock = new Map<string, number>();
  for (const listing of listings.data) {
    stock.set(listing.shop_id, (stock.get(listing.shop_id) ?? 0) + (inventory.get(listing.id)?.available ?? 0));
  }
  const sales = summarizeOrdersByShop(orders, shopIds);
  return new Map(
    [...sales].map(([shopId, summary]) => [shopId, { ...summary, stock: stock.get(shopId) ?? 0 }]),
  );
}

/** Orders of one listing that are still in progress (the listing cannot be removed meanwhile). */
export async function countOpenOrders(listingId: string): Promise<number> {
  const { count, error } = await adminDb()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .in("status", [...OPEN_STATUSES]);
  if (error) throw dbError(error);
  return count ?? 0;
}

export async function getShopOrders(
  shopId: string,
  { statuses = null, page = 1, pageSize = 25 }: { statuses?: readonly OrderStatus[] | null; page?: number; pageSize?: number } = {},
): Promise<{ orders: SellerOrder[]; total: number }> {
  let query = adminDb()
    .from("orders")
    .select(
      "id, created_at, status, processing_started_at, failure_reason, delivery_method, seller_paid_at, quantity, total, buyer:players(name), listing:listings(id, title, material, unit_amount), locker:lockers(name)",
      { count: "exact" },
    )
    .eq("shop_id", shopId);
  if (statuses) query = query.in("status", [...statuses]);

  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + pageSize - 1);
  if (error) throw dbError(error);

  const orders = data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    processingStartedAt: row.processing_started_at,
    failureReason: row.failure_reason,
    delivery: parseDeliveryMethod(row.delivery_method),
    sellerPaidAt: row.seller_paid_at,
    quantity: row.quantity,
    total: Number(row.total),
    buyerName: row.buyer?.name ?? null,
    listing: row.listing
      ? {
          id: row.listing.id,
          title: row.listing.title,
          material: row.listing.material,
          unitAmount: row.listing.unit_amount,
        }
      : null,
    lockerName: row.locker?.name ?? null,
  }));
  return { orders, total: count ?? 0 };
}
