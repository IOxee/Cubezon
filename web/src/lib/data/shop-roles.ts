import "server-only";

import { cache } from "react";
import { parsePermissions, SHOP_PERMISSIONS, type ShopPermission } from "@/lib/seller/permissions";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";

/**
 * Ranks of a shop (shop_roles, private: secret key) and the permissions of the players in it. The
 * database creates the default ranks of every new shop, gives the default rank to new hires, moves
 * the members of a deleted rank to the default one and caps the ranks per shop. Call the writes
 * only after requireSellerShop() checked the player (ranks: owner only) and always with that
 * shop's id.
 */

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

export type ShopRole = {
  id: string;
  name: string;
  position: number;
  permissions: ShopPermission[];
  isDefault: boolean;
  members: number;
};

/** Permissions of the player in the shop: all for the owner, the rank's for an employee, null otherwise. */
export const getShopPermissions = cache(async (shopId: string, playerUuid: string): Promise<ShopPermission[] | null> => {
  const { data, error } = await adminDb().rpc("shop_permissions_of", { p_shop: shopId, p_player: playerUuid });
  if (error) throw dbError(error);
  return data === null ? null : parsePermissions(data);
});

/** Ranks of the shop in their order, with how many employees have each one. */
export async function getShopRoles(shopId: string): Promise<ShopRole[]> {
  const { data, error } = await adminDb()
    .from("shop_roles")
    .select("id, name, position, permissions, is_default, members:shop_members(count)")
    .eq("shop_id", shopId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw dbError(error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    permissions: parsePermissions(row.permissions),
    isDefault: row.is_default,
    members: row.members[0]?.count ?? 0,
  }));
}

/** Ranks a shop can have (plugin_settings.max_shop_roles, from config roles.max-per-shop). */
export async function getMaxShopRoles(): Promise<number> {
  const { data, error } = await publicDb().from("plugin_settings").select("value").eq("key", "max_shop_roles").maybeSingle();
  if (error) throw dbError(error);
  const value = Number(data?.value);
  return Number.isInteger(value) && value > 0 ? value : 10;
}

export type RoleInput = { name: string; permissions: ShopPermission[] };

function sorted(permissions: ShopPermission[]): ShopPermission[] {
  return SHOP_PERMISSIONS.filter((permission) => permissions.includes(permission));
}

/** New rank, last in the order. "exists": another rank has that name; "limit": too many ranks. */
export async function createShopRole(shopId: string, input: RoleInput): Promise<"ok" | "exists" | "limit"> {
  const db = adminDb();
  const { data: last, error: lastError } = await db
    .from("shop_roles")
    .select("position")
    .eq("shop_id", shopId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw dbError(lastError);

  const { error } = await db.from("shop_roles").insert({
    shop_id: shopId,
    name: input.name,
    permissions: sorted(input.permissions),
    position: (last?.position ?? 0) + 1,
  });
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error?.code === CHECK_VIOLATION && error.message.startsWith("SHOP_ROLES_EXCEEDED")) return "limit";
  if (error) throw dbError(error);
  return "ok";
}

export async function updateShopRole(shopId: string, roleId: string, input: RoleInput): Promise<"ok" | "exists" | "notFound"> {
  const { data, error } = await adminDb()
    .from("shop_roles")
    .update({ name: input.name, permissions: sorted(input.permissions) })
    .eq("id", roleId)
    .eq("shop_id", shopId)
    .select("id");
  if (error?.code === UNIQUE_VIOLATION) return "exists";
  if (error) throw dbError(error);
  return data.length > 0 ? "ok" : "notFound";
}

/** Deletes a rank (its employees move to the default rank). The default rank cannot be deleted. */
export async function deleteShopRole(shopId: string, roleId: string): Promise<"ok" | "default" | "notFound"> {
  const { data, error } = await adminDb().from("shop_roles").delete().eq("id", roleId).eq("shop_id", shopId).select("id");
  if (error?.code === CHECK_VIOLATION && error.message.startsWith("DEFAULT_ROLE_CANNOT_BE_DELETED")) return "default";
  if (error) throw dbError(error);
  return data.length > 0 ? "ok" : "notFound";
}

/** Makes a rank of the shop the one new hires get (one transaction, in the database). */
export async function setDefaultShopRole(shopId: string, roleId: string): Promise<boolean> {
  const { data, error } = await adminDb().rpc("set_default_shop_role", { p_shop: shopId, p_role: roleId });
  if (error) throw dbError(error);
  return data === true;
}

export async function setMemberRole(shopId: string, playerUuid: string, roleId: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("shop_members")
    .update({ role_id: roleId })
    .eq("shop_id", shopId)
    .eq("player_uuid", playerUuid)
    .select("player_uuid");
  if (error) throw dbError(error);
  return data.length > 0;
}
