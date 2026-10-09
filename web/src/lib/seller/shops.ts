import type { ShopStatus } from "./stats";

/**
 * Pure rules about the shops of one player: their shop slots and where their panel lives.
 * A player can own several shops; each one has its own panel at /panel/<slug>.
 *
 * How many shops a player may have is decided by the database (players.shop_slots, or the
 * default the plugin publishes from config.yml shops.default-slots). public.shop_slots_of()
 * returns it and the trigger shops_check_slots enforces it: these helpers only read the result.
 */

/** Range of players.shop_slots (CHECK in the database). */
export const SHOP_SLOTS = { min: 0, max: 100 } as const;

/** Shop slots of a player, as public.shop_slots_of() returns them. */
export type ShopSlots = {
  /** Shops they may have (their own number, or the default one). */
  slots: number;
  /** Shops using a slot: every one of theirs except the REJECTED ones. */
  used: number;
  /** Slots left (never negative, even when an admin lowered the slots below `used`). */
  free: number;
  /** Whether `slots` is their own number (players.shop_slots) rather than the default. */
  custom: boolean;
};

/** A shop uses a slot unless it was rejected (same rule as the database). */
export function countsTowardShopLimit(status: ShopStatus): boolean {
  return status !== "REJECTED";
}

/**
 * Slots of a player from their raw data, like public.shop_slots_of(): their own number, or the
 * default when it is null. For lists (one query for many players); for one player, ask the RPC.
 */
export function resolveShopSlots(own: number | null, defaultSlots: number, used: number): ShopSlots {
  const slots = own ?? defaultSlots;
  return { slots, used, free: Math.max(slots - used, 0), custom: own !== null };
}

/**
 * Whether one more shop can go to review: a new request or a corrected rejected one (it goes
 * back to PENDING, so it takes a slot again).
 */
export function canRequestShop(slots: Pick<ShopSlots, "free">): boolean {
  return slots.free > 0;
}

/** Whether the player has more shops than slots (an admin lowered them; their shops stay). */
export function isOverShopSlots(slots: Pick<ShopSlots, "slots" | "used">): boolean {
  return slots.used > slots.slots;
}

/**
 * Slots typed by an admin: a whole number in SHOP_SLOTS, or "reset" for the default (null).
 * Returns undefined when it is not valid.
 */
export function parseShopSlotsInput(value: unknown): number | null | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "reset") return null;
  if (!/^\d{1,3}$/.test(text)) return undefined;
  const slots = Number(text);
  return slots >= SHOP_SLOTS.min && slots <= SHOP_SLOTS.max ? slots : undefined;
}

/** Postgres check_violation, the code the shops_check_slots trigger raises. */
const CHECK_VIOLATION = "23514";

/** Whether a database error is the trigger refusing a shop because its owner has no free slot. */
export function isShopSlotsExceeded(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === CHECK_VIOLATION && (error.message ?? "").startsWith("SHOP_SLOTS_EXCEEDED");
}

/**
 * Panel URL of a shop, one path segment per argument:
 * panelPath("minas-paco", "productos", id) -> "/panel/minas-paco/productos/<id>".
 */
export function panelPath(slug: string, ...segments: string[]): string {
  return ["/panel", ...[slug, ...segments].filter(Boolean).map(encodeURIComponent)].join("/");
}
