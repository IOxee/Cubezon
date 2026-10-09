import "server-only";

import type { Player } from "@/lib/auth/session";
import type { CheckoutListing, PricedLine } from "@/lib/cart";
import { expressFeeByLine, parseDeliveryMethod, type DeliveryMethod } from "@/lib/delivery";
import { centsToDecimal } from "@/lib/format";
import { getCatalogItemsFresh, type CatalogItem } from "@/lib/data/catalog";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";

/**
 * Orders of the logged-in buyer (secret key, so every query filters by the player from
 * requirePlayer). The web only creates PENDING orders; every later transition is the plugin's.
 */

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ORDER_GROUPS = {
  active: ["PENDING", "PAID", "READY"],
  collected: ["COLLECTED"],
  issues: ["FAILED", "REFUNDED"],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type OrderGroup = keyof typeof ORDER_GROUPS | "all";

/** States the plugin will not move any further. */
export const FINAL_STATUSES: readonly OrderStatus[] = ["COLLECTED", "FAILED", "REFUNDED"];

export const ORDERS_PAGE_SIZE = 15;

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  /** Set while the plugin charges a PENDING order (shown as "Procesando"). */
  processingStartedAt: string | null;
  /** Code set by the plugin on FAILED/REFUNDED orders (SHOP_REJECTED and EXPIRED read "Cancelado"). */
  failureReason: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  listing: { id: string; title: string; material: string; unitAmount: number };
  shop: { id: string; name: string; slug: string; ink: string; official: boolean };
  /** LOCKER: picked up at `locker`. MAILBOX: express delivery to the buyer's `mailbox`. */
  delivery: DeliveryMethod;
  locker: { id: string; name: string; world: string; x: number; y: number; z: number; active: boolean } | null;
  /** Null once the mailbox was removed in the game. */
  mailbox: { world: string; x: number; y: number; z: number } | null;
  /** Express fee, charged apart from `total` (0 for locker orders and other lines of a purchase). */
  expressFee: number;
};

export type OrderEvent = { status: OrderStatus; at: string; note: string | null };

export type OrderDetail = OrderSummary & {
  paidAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  events: OrderEvent[];
  review: { rating: number; body: string; updatedAt: string } | null;
};

const SUMMARY_COLUMNS =
  "id, status, processing_started_at, failure_reason, quantity, unit_price, total, created_at, delivery_method, express_fee, listing:listings(id, title, material, unit_amount), shop:shops(id, name, slug, ink, official), locker:lockers(id, name, world, x, y, z, active), mailbox:mailboxes(world, x, y, z)";

type SummaryRow = {
  id: string;
  status: OrderStatus;
  processing_started_at: string | null;
  failure_reason: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
  delivery_method: string;
  express_fee: number;
  listing: { id: string; title: string; material: string; unit_amount: number };
  shop: { id: string; name: string; slug: string; ink: string; official: boolean };
  locker: { id: string; name: string; world: string; x: number; y: number; z: number; active: boolean } | null;
  mailbox: { world: string; x: number; y: number; z: number } | null;
};

function toSummary(row: SummaryRow): OrderSummary {
  return {
    id: row.id,
    status: row.status,
    processingStartedAt: row.processing_started_at,
    failureReason: row.failure_reason,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    createdAt: row.created_at,
    listing: {
      id: row.listing.id,
      title: row.listing.title,
      material: row.listing.material,
      unitAmount: row.listing.unit_amount,
    },
    shop: row.shop,
    delivery: parseDeliveryMethod(row.delivery_method),
    locker: row.locker,
    mailbox: row.mailbox,
    expressFee: Number(row.express_fee),
  };
}

/** The buyer's orders, newest first, optionally filtered by group. */
export async function listMyOrders(
  player: Player,
  { group = "all", page = 1, pageSize = ORDERS_PAGE_SIZE }: { group?: OrderGroup; page?: number; pageSize?: number } = {},
): Promise<{ orders: OrderSummary[]; total: number }> {
  let request = adminDb()
    .from("orders")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("buyer_uuid", player.uuid);
  if (group !== "all") request = request.in("status", [...ORDER_GROUPS[group]]);

  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + pageSize - 1);
  if (error) throw dbError(error);
  return { orders: (data ?? []).map((row) => toSummary(row as SummaryRow)), total: count ?? 0 };
}

async function countOrders(player: Player, statuses: readonly OrderStatus[]): Promise<number> {
  const { count, error } = await adminDb()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_uuid", player.uuid)
    .in("status", [...statuses]);
  if (error) throw dbError(error);
  return count ?? 0;
}

/** Number of orders of the buyer in each group (for the tabs). */
export async function countMyOrders(player: Player): Promise<Record<OrderGroup, number>> {
  const [active, collected, issues] = await Promise.all([
    countOrders(player, ORDER_GROUPS.active),
    countOrders(player, ORDER_GROUPS.collected),
    countOrders(player, ORDER_GROUPS.issues),
  ]);
  return { all: active + collected + issues, active, collected, issues };
}

/** One order of the buyer with its events and review, or null if it is not theirs. */
export async function getMyOrder(player: Player, orderId: string): Promise<OrderDetail | null> {
  const { data, error } = await adminDb()
    .from("orders")
    .select(
      `${SUMMARY_COLUMNS}, paid_at, ready_at, collected_at, events:order_events(to_status, note, created_at), review:reviews(rating, body, updated_at)`,
    )
    .eq("id", orderId)
    .eq("buyer_uuid", player.uuid)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;

  const row = data as unknown as SummaryRow & {
    paid_at: string | null;
    ready_at: string | null;
    collected_at: string | null;
    events: { to_status: OrderStatus; note: string | null; created_at: string }[];
    review: { rating: number; body: string; updated_at: string } | { rating: number; body: string; updated_at: string }[] | null;
  };
  const review = Array.isArray(row.review) ? (row.review[0] ?? null) : row.review;

  return {
    ...toSummary(row),
    paidAt: row.paid_at,
    readyAt: row.ready_at,
    collectedAt: row.collected_at,
    events: [...(row.events ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({ status: event.to_status, at: event.created_at, note: event.note })),
    review: review ? { rating: review.rating, body: review.body, updatedAt: review.updated_at } : null,
  };
}

/** Numbers for the account page: orders in progress, waiting in a locker, and the player's shops. */
export async function getAccountOverview(player: Player): Promise<{
  activeOrders: number;
  readyOrders: number;
  /** Status of each of the player's shops (a player can have several), oldest first. */
  shopStatuses: Database["public"]["Enums"]["shop_status"][];
  /** Shops where the player is an employee (shop_members). */
  employeeShops: number;
}> {
  const [activeOrders, readyOrders, shops, memberships] = await Promise.all([
    countOrders(player, ORDER_GROUPS.active),
    countOrders(player, ["READY"]),
    adminDb().from("shops").select("status").eq("owner_uuid", player.uuid).order("created_at"),
    adminDb().from("shop_members").select("shop_id", { count: "exact", head: true }).eq("player_uuid", player.uuid),
  ]);
  if (shops.error) throw dbError(shops.error);
  if (memberships.error) throw dbError(memberships.error);
  return {
    activeOrders,
    readyOrders,
    shopStatuses: shops.data.map((shop) => shop.status),
    employeeShops: memberships.count ?? 0,
  };
}

/** Owner of each shop (to stop sellers from buying from themselves). */
export async function getShopOwners(shopIds: string[]): Promise<Map<string, string>> {
  if (shopIds.length === 0) return new Map();
  const { data, error } = await adminDb().from("shops").select("id, owner_uuid").in("id", shopIds);
  if (error) throw dbError(error);
  return new Map((data ?? []).map((shop) => [shop.id, shop.owner_uuid]));
}

/**
 * Fresh (uncached) data to check a checkout: catalog items (current price and stock) and the
 * same listings with the owner of their shop, ready for priceCheckout.
 */
export async function getCheckoutListings(
  listingIds: string[],
): Promise<{ items: Map<string, CatalogItem>; listings: Map<string, CheckoutListing> }> {
  const items = await getCatalogItemsFresh(listingIds);
  const owners = await getShopOwners([...new Set([...items.values()].map((item) => item.shop.id))]);
  const listings = new Map<string, CheckoutListing>();
  for (const item of items.values()) {
    listings.set(item.id, {
      id: item.id,
      shopId: item.shop.id,
      shopOwnerUuid: owners.get(item.shop.id) ?? null,
      unitPrice: item.unitPrice,
      unitsAvailable: item.unitsAvailable,
    });
  }
  return { items, listings };
}

/** Fresh check (no cache): the locker exists and is active (RLS shows only active ones). */
export async function isActiveLocker(lockerId: string): Promise<boolean> {
  const { data, error } = await publicDb().from("lockers").select("id").eq("id", lockerId).maybeSingle();
  if (error) throw dbError(error);
  return data !== null;
}

/** Where the orders of a checkout go: a locker, or the buyer's mailbox with the current express fee. */
export type CheckoutDelivery =
  | { method: "LOCKER"; lockerId: string }
  | { method: "MAILBOX"; mailboxId: string; feeCents: number };

/**
 * Creates one PENDING order per line in a single insert (one statement, so all or nothing).
 * Lines come from priceCheckout: unit_price copied from the listing and total = unit_price *
 * quantity computed in cents, sent as exact decimal strings. Express: the fee (copied now, like
 * the price) goes once per purchase, on one line (expressFeeByLine); the database checks that the
 * mailbox is the buyer's.
 */
export async function createOrders(player: Player, delivery: CheckoutDelivery, lines: PricedLine[]): Promise<string[]> {
  const fees =
    delivery.method === "MAILBOX"
      ? expressFeeByLine(lines.map((line) => line.totalCents), delivery.feeCents)
      : lines.map(() => 0);
  const rows = lines.map((line, index) => ({
    buyer_uuid: player.uuid,
    listing_id: line.listingId,
    shop_id: line.shopId,
    delivery_method: delivery.method,
    locker_id: delivery.method === "LOCKER" ? delivery.lockerId : null,
    mailbox_id: delivery.method === "MAILBOX" ? delivery.mailboxId : null,
    quantity: line.quantity,
    // numeric(14, 2) columns: PostgREST takes decimal strings, which keeps them exact.
    unit_price: line.unitPrice as unknown as number,
    total: line.total as unknown as number,
    express_fee: centsToDecimal(fees[index]) as unknown as number,
    status: "PENDING",
  })) satisfies TablesInsert<"orders">[];

  const { data, error } = await adminDb().from("orders").insert(rows).select("id");
  if (error) throw dbError(error);
  return (data ?? []).map((row) => row.id);
}

export type SaveReviewResult = { ok: true; listingId: string; shopId: string } | { ok: false };

/**
 * Creates or updates the review of a collected order of the player. The database trigger
 * check_review_order validates it again (author, status, listing and shop of the order).
 */
export async function saveReview(player: Player, orderId: string, rating: number, body: string): Promise<SaveReviewResult> {
  const db = adminDb();
  const { data: order, error } = await db
    .from("orders")
    .select("id, listing_id, shop_id, status")
    .eq("id", orderId)
    .eq("buyer_uuid", player.uuid)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!order || order.status !== "COLLECTED") return { ok: false };

  const { error: upsertError } = await db.from("reviews").upsert(
    {
      order_id: order.id,
      listing_id: order.listing_id,
      shop_id: order.shop_id,
      author_uuid: player.uuid,
      rating,
      body,
    },
    { onConflict: "order_id" },
  );
  if (upsertError) throw dbError(upsertError);
  return { ok: true, listingId: order.listing_id, shopId: order.shop_id };
}
