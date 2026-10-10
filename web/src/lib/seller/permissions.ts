/**
 * Shop ranks (shop_roles) and their permissions: the same rules as in the game (pure, also used
 * by client components). The owner has every permission and is the only one who manages ranks.
 * Someone else with staff.manage hires, fires and assigns ranks, but never a rank with
 * staff.manage, and never touches a member who already has it (no self-promotions).
 */

/** Same list, in the same order, as public.shop_permission_list(). */
export const SHOP_PERMISSIONS = [
  "orders.decide",
  "orders.package",
  "stock.deposit",
  "stock.withdraw",
  "products.manage",
  "staff.manage",
  "storage.buy",
] as const;

export type ShopPermission = (typeof SHOP_PERMISSIONS)[number];

export const ROLE_NAME_MAX = 24;

/** Who acts in a shop's panel: its owner, or an employee with their rank's permissions. */
export type StaffActor = { isOwner: boolean; permissions: readonly string[] };

export function isShopPermission(value: unknown): value is ShopPermission {
  return typeof value === "string" && (SHOP_PERMISSIONS as readonly string[]).includes(value);
}

/** Known permissions only, without repeats, in the canonical order. */
export function parsePermissions(values: readonly unknown[] | null | undefined): ShopPermission[] {
  const set = new Set((values ?? []).filter(isShopPermission));
  return SHOP_PERMISSIONS.filter((permission) => set.has(permission));
}

export function can(actor: StaffActor, permission: ShopPermission): boolean {
  return actor.isOwner || actor.permissions.includes(permission);
}

/** Whether the actor may give a rank with these permissions (when hiring or changing a rank). */
export function canAssignRole(actor: StaffActor, rolePermissions: readonly string[]): boolean {
  if (actor.isOwner) return true;
  return can(actor, "staff.manage") && !rolePermissions.includes("staff.manage");
}

/** Whether the actor may change the rank of, or fire, a member whose rank has these permissions. */
export function canManageMember(actor: StaffActor, memberPermissions: readonly string[]): boolean {
  return canAssignRole(actor, memberPermissions);
}

/** Rank name: trimmed, inner spaces collapsed, 1 to 24 characters. */
export function parseRoleName(value: unknown): { name: string } | { error: "required" | "length" } {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "required" };
  if ([...name].length > ROLE_NAME_MAX) return { error: "length" };
  return { name };
}
