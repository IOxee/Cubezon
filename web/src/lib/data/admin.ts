import "server-only";
import { parseDeliveryMethod, type DeliveryMethod } from "@/lib/delivery";

import { connection } from "next/server";
import type { Player, StaffRole } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { adminDb, dbError } from "@/lib/supabase/server";

/**
 * Data of the admin area. Everything here uses the secret key (no RLS), so call it only
 * after requireStaff() / requireStaff("SUPERADMIN") in the page or Server Action.
 * Orders are read-only: the plugin is the only authority over their status.
 */

export type ShopStatus = Database["public"]["Enums"]["shop_status"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const SHOP_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const satisfies readonly ShopStatus[];
export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "READY",
  "COLLECTED",
  "FAILED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];
export const STAFF_ROLES = ["ADMIN", "SUPERADMIN"] as const satisfies readonly StaffRole[];

/** Orders still moving through the pipeline (not finished). */
const OPEN_ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "READY"];

export const ADMIN_PAGE_SIZE = 50;
/** A PENDING order older than this probably means the plugin is not polling. */
export const STALE_PENDING_MINUTES = 5;
export const REVIEW_NOTE_MAX = 300;

export function isShopStatus(value: unknown): value is ShopStatus {
  return typeof value === "string" && (SHOP_STATUSES as readonly string[]).includes(value);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

type Counted = { count: number | null; error: unknown };

function countOf(result: Counted): number {
  if (result.error) throw result.error;
  return result.count ?? 0;
}

/** Epoch millis before which a PENDING order counts as stuck. */
function staleCutoff(): number {
  return Date.now() - STALE_PENDING_MINUTES * 60_000;
}

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Overview

export type StuckOrder = { id: string; createdAt: string; total: number; buyerName: string };

export type AdminOverview = {
  pendingShops: number;
  ordersByStatus: Record<OrderStatus, number>;
  stuck: { count: number; oldest: StuckOrder[] };
  lockers: { active: number; total: number };
  players: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await connection(); // reads the clock
  const db = adminDb();
  const head = { count: "exact", head: true } as const;

  const [pendingShops, players, lockersTotal, lockersActive, stuck, orderCounts] = await Promise.all([
    db.from("shops").select("id", head).eq("status", "PENDING"),
    db.from("players").select("uuid", head),
    db.from("lockers").select("id", head),
    db.from("lockers").select("id", head).eq("active", true),
    db
      .from("orders")
      .select("id, created_at, total, buyer:players(name)", { count: "exact" })
      .eq("status", "PENDING")
      .lt("created_at", new Date(staleCutoff()).toISOString())
      .order("created_at", { ascending: true })
      .limit(5),
    Promise.all(ORDER_STATUSES.map((status) => db.from("orders").select("id", head).eq("status", status))),
  ]);

  if (stuck.error) throw stuck.error;
  const ordersByStatus = Object.fromEntries(
    ORDER_STATUSES.map((status, i) => [status, countOf(orderCounts[i])]),
  ) as Record<OrderStatus, number>;

  return {
    pendingShops: countOf(pendingShops),
    ordersByStatus,
    stuck: {
      count: stuck.count ?? 0,
      oldest: (stuck.data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        total: Number(row.total),
        buyerName: row.buyer?.name ?? "",
      })),
    },
    lockers: { active: countOf(lockersActive), total: countOf(lockersTotal) },
    players: countOf(players),
  };
}

// Shops

export type AdminShop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  ink: string;
  official: boolean;
  status: ShopStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  ownerName: string;
  /** Logo in the shop-media bucket (shopMediaUrl() gives the URL), or null. */
  logoPath: string | null;
  /** Cuboid marked in the game with /cz shop <slug>; null until an admin marks it. */
  zone: ShopZone | null;
  /** Storage blocks placed inside the zone (private view shop_storage). */
  storage: { blocks: number; capacity: number; used: number };
};

export type ShopZone = { world: string; min: [number, number, number]; max: [number, number, number] };

const SHOP_COLUMNS =
  "id, name, slug, description, ink, official, status, review_note, created_at, reviewed_at, logo_path, zone_world, zone_min_x, zone_min_y, zone_min_z, zone_max_x, zone_max_y, zone_max_z, owner:players!shops_owner_uuid_fkey(name), reviewer:players!shops_reviewed_by_fkey(name)";

type ZoneColumns = {
  zone_world: string | null;
  zone_min_x: number | null;
  zone_min_y: number | null;
  zone_min_z: number | null;
  zone_max_x: number | null;
  zone_max_y: number | null;
  zone_max_z: number | null;
};

function zoneOf(row: ZoneColumns): ShopZone | null {
  if (row.zone_world === null || row.zone_min_x === null || row.zone_max_x === null) return null;
  return {
    world: row.zone_world,
    min: [row.zone_min_x, row.zone_min_y ?? 0, row.zone_min_z ?? 0],
    max: [row.zone_max_x, row.zone_max_y ?? 0, row.zone_max_z ?? 0],
  };
}

async function storageByShop(shopIds: string[]): Promise<Map<string, AdminShop["storage"]>> {
  if (shopIds.length === 0) return new Map();
  const { data, error } = await adminDb()
    .from("shop_storage")
    .select("shop_id, storage_blocks, capacity_units, used_units")
    .in("shop_id", shopIds);
  if (error) throw dbError(error);
  return new Map(
    (data ?? []).map((row) => [
      row.shop_id!,
      { blocks: row.storage_blocks ?? 0, capacity: row.capacity_units ?? 0, used: row.used_units ?? 0 },
    ]),
  );
}

export async function countShopsByStatus(): Promise<Record<ShopStatus, number>> {
  const db = adminDb();
  const results = await Promise.all(
    SHOP_STATUSES.map((status) => db.from("shops").select("id", { count: "exact", head: true }).eq("status", status)),
  );
  return Object.fromEntries(SHOP_STATUSES.map((status, i) => [status, countOf(results[i])])) as Record<
    ShopStatus,
    number
  >;
}

/** Shops in one status. Pending ones oldest first (a queue); the rest by latest review. */
export async function listShops(status: ShopStatus, page: number): Promise<{ shops: AdminShop[]; total: number }> {
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  let request = adminDb().from("shops").select(SHOP_COLUMNS, { count: "exact" }).eq("status", status);
  request =
    status === "PENDING"
      ? request.order("created_at", { ascending: true })
      : request.order("reviewed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  const { data, error, count } = await request.order("id").range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw dbError(error);
  const storage = await storageByShop((data ?? []).map((row) => row.id));
  return {
    total: count ?? 0,
    shops: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      ink: row.ink,
      official: row.official,
      status: row.status,
      reviewNote: row.review_note,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewerName: row.reviewer?.name ?? null,
      ownerName: row.owner?.name ?? "",
      logoPath: row.logo_path,
      zone: zoneOf(row),
      storage: storage.get(row.id) ?? { blocks: 0, capacity: 0, used: 0 },
    })),
  };
}

export const SHOP_DECISIONS = ["approve", "reject", "suspend", "reactivate"] as const;
export type ShopDecision = (typeof SHOP_DECISIONS)[number];

/** Allowed review transitions: which statuses each decision accepts and where it leads. */
const SHOP_TRANSITIONS: Record<ShopDecision, { from: ShopStatus[]; to: ShopStatus }> = {
  approve: { from: ["PENDING", "REJECTED"], to: "APPROVED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  suspend: { from: ["APPROVED"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "APPROVED" },
};

export function isShopDecision(value: unknown): value is ShopDecision {
  return typeof value === "string" && (SHOP_DECISIONS as readonly string[]).includes(value);
}

export function decisionsFor(status: ShopStatus): ShopDecision[] {
  return SHOP_DECISIONS.filter((decision) => SHOP_TRANSITIONS[decision].from.includes(status));
}

/**
 * Applies a review decision, only if the shop is still in a status that allows it (so two
 * admins reviewing at once cannot undo each other). Returns null when nothing changed.
 */
export async function reviewShop(
  reviewer: Player,
  shopId: string,
  decision: ShopDecision,
  note: string | null,
): Promise<{ name: string; slug: string } | null> {
  const { from, to } = SHOP_TRANSITIONS[decision];
  const { data, error } = await adminDb()
    .from("shops")
    .update({ status: to, review_note: note, reviewed_by: reviewer.uuid, reviewed_at: new Date().toISOString() })
    .eq("id", shopId)
    .in("status", from)
    .select("name, slug")
    .maybeSingle();
  if (error) throw dbError(error);
  return data;
}

export async function setShopOfficial(
  shopId: string,
  official: boolean,
): Promise<{ name: string; slug: string } | null> {
  const { data, error } = await adminDb()
    .from("shops")
    .update({ official })
    .eq("id", shopId)
    .select("name, slug")
    .maybeSingle();
  if (error) throw dbError(error);
  return data;
}

// Orders (read-only)

export type AdminOrderRow = {
  id: string;
  status: OrderStatus;
  processingStartedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  quantity: number;
  total: number;
  /** PENDING for longer than STALE_PENDING_MINUTES. */
  stuck: boolean;
  buyerName: string;
  shop: { name: string; slug: string; ink: string };
  listingTitle: string;
  lockerName: string;
  delivery: DeliveryMethod;
};

export type OrderListQuery = { status: OrderStatus | null; q: string; page: number };

const MINECRAFT_NAME = /^[A-Za-z0-9_]{1,16}$/;

/** "4F2A-91C0", "#4f2a91c0" or a full uuid -> lowercase hex prefix of the id, or null. */
function serialPrefix(q: string): string | null {
  const hex = q.replace(/^(n[ºo°]\s*)/i, "").replace(/[\s#-]/g, "").toLowerCase();
  return /^[0-9a-f]{4,32}$/.test(hex) ? hex : null;
}

function uuidFromHex(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
}

/**
 * Builds the PostgREST "or" filter for a search: buyer name contains the text, or the order
 * id starts with the given serial. Returns null when nothing can match.
 */
async function orderSearchFilter(q: string): Promise<string | null> {
  const parts: string[] = [];

  if (MINECRAFT_NAME.test(q)) {
    const { data, error } = await adminDb()
      .from("players")
      .select("uuid")
      .ilike("name", `%${escapeLike(q)}%`)
      .limit(100);
    if (error) throw dbError(error);
    if (data.length > 0) parts.push(`buyer_uuid.in.(${data.map((p) => p.uuid).join(",")})`);
  }

  const prefix = serialPrefix(q);
  if (prefix) {
    const low = uuidFromHex(prefix.padEnd(32, "0"));
    const high = uuidFromHex(prefix.padEnd(32, "f"));
    parts.push(`and(id.gte.${low},id.lte.${high})`);
  }

  return parts.length > 0 ? parts.join(",") : null;
}

export async function listOrders(query: OrderListQuery): Promise<{ orders: AdminOrderRow[]; total: number }> {
  await connection(); // reads the clock
  let request = adminDb()
    .from("orders")
    .select(
      "id, status, processing_started_at, failure_reason, created_at, quantity, total, delivery_method, buyer:players(name), shop:shops(name, slug, ink), listing:listings(title), locker:lockers(name)",
      { count: "exact" },
    );

  if (query.status) request = request.eq("status", query.status);
  const q = query.q.trim();
  if (q) {
    const filter = await orderSearchFilter(q);
    if (!filter) return { orders: [], total: 0 };
    request = request.or(filter);
  }

  const from = (query.page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw dbError(error);

  const cutoff = staleCutoff();
  return {
    total: count ?? 0,
    orders: (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      processingStartedAt: row.processing_started_at,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      quantity: row.quantity,
      total: Number(row.total),
      stuck: row.status === "PENDING" && Date.parse(row.created_at) < cutoff,
      buyerName: row.buyer?.name ?? "",
      shop: { name: row.shop?.name ?? "", slug: row.shop?.slug ?? "", ink: row.shop?.ink ?? "grafito" },
      listingTitle: row.listing?.title ?? "",
      lockerName: row.locker?.name ?? "",
      delivery: parseDeliveryMethod(row.delivery_method),
    })),
  };
}

export type OrderEvent = {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  status: OrderStatus;
  processingStartedAt: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  buyer: { uuid: string; name: string };
  shop: { id: string; name: string; slug: string; ink: string; official: boolean; status: ShopStatus } | null;
  listing: {
    id: string;
    title: string;
    material: string;
    unitAmount: number;
    status: Database["public"]["Enums"]["listing_status"];
  } | null;
  locker: { id: string; name: string; world: string; x: number; y: number; z: number; active: boolean } | null;
  /** Express orders: the buyer's mailbox (null once removed) and the fee charged apart from total. */
  delivery: DeliveryMethod;
  mailbox: { world: string; x: number; y: number; z: number } | null;
  expressFee: number;
  events: OrderEvent[];
};

export async function getOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const db = adminDb();
  const [order, events] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, status, processing_started_at, quantity, unit_price, total, failure_reason, created_at, updated_at, paid_at, ready_at, collected_at, buyer_uuid, buyer:players(name), shop:shops(id, name, slug, ink, official, status), listing:listings(id, title, material, unit_amount, status), locker:lockers(id, name, world, x, y, z, active), delivery_method, express_fee, mailbox:mailboxes(world, x, y, z)",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("order_events")
      .select("id, from_status, to_status, note, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (order.error) throw order.error;
  if (events.error) throw events.error;
  const row = order.data;
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    processingStartedAt: row.processing_started_at,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    readyAt: row.ready_at,
    collectedAt: row.collected_at,
    buyer: { uuid: row.buyer_uuid, name: row.buyer?.name ?? "" },
    shop: row.shop,
    listing: row.listing
      ? {
          id: row.listing.id,
          title: row.listing.title,
          material: row.listing.material,
          unitAmount: row.listing.unit_amount,
          status: row.listing.status,
        }
      : null,
    locker: row.locker,
    delivery: parseDeliveryMethod(row.delivery_method),
    mailbox: row.mailbox,
    expressFee: Number(row.express_fee),
    events: (events.data ?? []).map((event) => ({
      id: event.id,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      note: event.note,
      createdAt: event.created_at,
    })),
  };
}

// Lockers

export type AdminLocker = {
  id: string;
  name: string;
  world: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  createdAt: string;
  /** Orders assigned to it that are not finished yet (PENDING, PAID, READY). */
  openOrders: number;
};

export async function listLockers(): Promise<AdminLocker[]> {
  const db = adminDb();
  const { data, error } = await db
    .from("lockers")
    .select("id, name, world, x, y, z, active, created_at")
    .order("name");
  if (error) throw dbError(error);

  // Lockers are few: one exact count per locker keeps it simple and correct.
  const counts = await Promise.all(
    data.map((locker) =>
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("locker_id", locker.id)
        .in("status", OPEN_ORDER_STATUSES),
    ),
  );

  return data.map((locker, i) => ({
    id: locker.id,
    name: locker.name,
    world: locker.world,
    x: locker.x,
    y: locker.y,
    z: locker.z,
    active: locker.active,
    createdAt: locker.created_at,
    openOrders: countOf(counts[i]),
  }));
}

export async function setLockerActive(lockerId: string, active: boolean): Promise<{ name: string } | null> {
  const { data, error } = await adminDb()
    .from("lockers")
    .update({ active })
    .eq("id", lockerId)
    .select("name")
    .maybeSingle();
  if (error) throw dbError(error);
  return data;
}

// Staff (superadmin only)

export type StaffMember = {
  uuid: string;
  name: string;
  role: StaffRole;
  since: string;
  grantedByName: string | null;
};

export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await adminDb()
    .from("staff")
    .select(
      "player_uuid, role, created_at, player:players!staff_player_uuid_fkey(name), granter:players!staff_granted_by_fkey(name)",
    )
    .order("created_at", { ascending: true });
  if (error) throw dbError(error);
  return data.map((row) => ({
    uuid: row.player_uuid,
    name: row.player?.name ?? "",
    role: row.role,
    since: row.created_at,
    grantedByName: row.granter?.name ?? null,
  }));
}

export function isMinecraftName(value: string): boolean {
  return MINECRAFT_NAME.test(value);
}

/** Exact, case-insensitive match on the in-game name (the most recently seen player wins). */
export async function findPlayerByName(name: string): Promise<{ uuid: string; name: string } | null> {
  const { data, error } = await adminDb()
    .from("players")
    .select("uuid, name")
    .ilike("name", escapeLike(name))
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(error);
  return data;
}

/** Returns false when the player is already staff. */
export async function addStaff(grantedBy: Player, playerUuid: string, role: StaffRole): Promise<boolean> {
  const { error } = await adminDb()
    .from("staff")
    .insert({ player_uuid: playerUuid, role, granted_by: grantedBy.uuid });
  if (error?.code === "23505") return false; // unique_violation
  if (error) throw dbError(error);
  return true;
}

/** Returns the member's name, or null if they are no longer staff. */
export async function setStaffRole(playerUuid: string, role: StaffRole): Promise<string | null> {
  const { data, error } = await adminDb()
    .from("staff")
    .update({ role })
    .eq("player_uuid", playerUuid)
    .select("player:players!staff_player_uuid_fkey(name)")
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? (data.player?.name ?? "") : null;
}

/** Returns the removed member's name, or null if they were not staff. */
export async function removeStaff(playerUuid: string): Promise<string | null> {
  const { data, error } = await adminDb()
    .from("staff")
    .delete()
    .eq("player_uuid", playerUuid)
    .select("player:players!staff_player_uuid_fkey(name)")
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? (data.player?.name ?? "") : null;
}
