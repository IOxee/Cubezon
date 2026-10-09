import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { parseOrdersMode, type OrdersMode } from "@/lib/order-display";
import { parsePermissions, type ShopPermission } from "@/lib/seller/permissions";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";

/**
 * Roleplay order mode: the mode the plugin publishes (plugin_settings, public), and the shop
 * employees (shop_members) and company computers (shop_computers), both private. The private
 * reads and writes use the secret key: call them only after requireSellerShop() and always with
 * that shop's id.
 */

/** The plugin rewrites plugin_settings at startup and cannot invalidate this tag. */
export const PLUGIN_SETTINGS_TAG = "plugin-settings";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

/** Order mode of the plugin; "automatic" when it has not published one yet. */
export async function getOrdersMode(): Promise<OrdersMode> {
  "use cache";
  // Published once when the server starts: re-check every minute.
  cacheLife("minutes");
  cacheTag(PLUGIN_SETTINGS_TAG);

  const { data, error } = await publicDb().from("plugin_settings").select("value").eq("key", "orders_mode").maybeSingle();
  if (error) throw dbError(error);
  return parseOrdersMode(data?.value);
}

// Company computers

/** Company computers placed in the shop's zone. */
export async function countShopComputers(shopId: string): Promise<number> {
  const { count, error } = await adminDb()
    .from("shop_computers")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if (error) throw dbError(error);
  return count ?? 0;
}

// Employees

export type ShopMember = {
  playerUuid: string;
  name: string | null;
  since: string;
  addedByName: string | null;
  /** Their rank in the shop (shop_roles); null only if the database has none for them. */
  role: { id: string; name: string; permissions: ShopPermission[] } | null;
};

const MEMBER_COLUMNS =
  "player_uuid, created_at, player:players!shop_members_player_uuid_fkey(name), adder:players!shop_members_added_by_fkey(name), role:shop_roles(id, name, permissions)";

type MemberRow = {
  player_uuid: string;
  created_at: string;
  player: { name: string } | null;
  adder: { name: string } | null;
  role: { id: string; name: string; permissions: string[] } | null;
};

function toMember(row: MemberRow): ShopMember {
  return {
    playerUuid: row.player_uuid,
    name: row.player?.name ?? null,
    since: row.created_at,
    addedByName: row.adder?.name ?? null,
    role: row.role ? { id: row.role.id, name: row.role.name, permissions: parsePermissions(row.role.permissions) } : null,
  };
}

/** Employees of the shop, oldest first. */
export async function getShopMembers(shopId: string): Promise<ShopMember[]> {
  const { data, error } = await adminDb()
    .from("shop_members")
    // Two FKs to players (player_uuid, added_by): name the one to embed.
    .select(MEMBER_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true })
    .order("player_uuid");
  if (error) throw dbError(error);
  return (data as unknown as MemberRow[]).map(toMember);
}

export async function getShopMember(shopId: string, playerUuid: string): Promise<ShopMember | null> {
  const { data, error } = await adminDb()
    .from("shop_members")
    .select(MEMBER_COLUMNS)
    .eq("shop_id", shopId)
    .eq("player_uuid", playerUuid)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? toMember(data as unknown as MemberRow) : null;
}

export async function countShopMembers(shopId: string): Promise<number> {
  const { count, error } = await adminDb()
    .from("shop_members")
    .select("player_uuid", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if (error) throw dbError(error);
  return count ?? 0;
}

/**
 * Player by Minecraft name, ignoring case like the plugin (lower(name) = lower(?)). Names can
 * change, so if several rows match, the one seen most recently wins.
 */
export async function findPlayerByName(name: string): Promise<{ uuid: string; name: string } | null> {
  const { data, error } = await adminDb()
    .from("players")
    .select("uuid, name")
    // Exact match ignoring case: escape the LIKE wildcards (Minecraft names may contain "_").
    .ilike("name", name.replace(/[\\%_]/g, (char) => `\\${char}`))
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (error) throw dbError(error);
  return data[0] ?? null;
}

/**
 * Adds an employee. "exists": they already were one. "limit": they already work for the most
 * shops allowed (a trigger checks plugin_settings.max_shop_memberships and fails with
 * SHOP_MEMBERSHIPS_EXCEEDED).
 */
export async function addShopMember(
  shopId: string,
  playerUuid: string,
  addedBy: string,
  roleId: string | null = null,
): Promise<"ok" | "exists" | "limit"> {
  const { error } = await adminDb()
    .from("shop_members")
    // Without a rank the database gives the shop's default one.
    .insert({ shop_id: shopId, player_uuid: playerUuid, added_by: addedBy, ...(roleId ? { role_id: roleId } : {}) });
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error?.code === CHECK_VIOLATION && error.message.startsWith("SHOP_MEMBERSHIPS_EXCEEDED")) return "limit";
  if (error) throw dbError(error);
  return "ok";
}

export type Memberships = { max: number; used: number; free: number };

/** How many shops (not their own) the player works for, and the global limit of the plugin. */
export async function getMemberships(playerUuid: string): Promise<Memberships> {
  const { data, error } = await adminDb().rpc("shop_memberships_of", { p_player: playerUuid });
  if (error) throw dbError(error);
  const row = data?.[0];
  return { max: row?.max_memberships ?? 1, used: row?.used ?? 0, free: row?.free ?? 0 };
}

/** Global limit of shops a player can work for (config.yml shops.max-memberships; 1 if missing). */
export async function getMaxMemberships(): Promise<number> {
  const { data, error } = await publicDb()
    .from("plugin_settings")
    .select("value")
    .eq("key", "max_shop_memberships")
    .maybeSingle();
  if (error) throw dbError(error);
  const value = Number(data?.value);
  return Number.isInteger(value) && value >= 0 ? value : 1;
}

/** Removes an employee from the shop. False when they were not one. */
export async function removeShopMember(shopId: string, playerUuid: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("shop_members")
    .delete()
    .eq("shop_id", shopId)
    .eq("player_uuid", playerUuid)
    .select("player_uuid");
  if (error) throw dbError(error);
  return data.length > 0;
}
