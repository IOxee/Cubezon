"use server";

import { refresh } from "next/cache";
import { fmt, m } from "@/i18n";
import { isUuid } from "@/lib/data/catalog";
import { addShopMember, findPlayerByName, getMemberships, getShopMember, removeShopMember } from "@/lib/data/roleplay";
import { requireSellerShop, staffActor } from "@/lib/data/seller";
import { getShopRoles, setMemberRole } from "@/lib/data/shop-roles";
import { canAssignRole, canManageMember } from "@/lib/seller/permissions";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { parsePlayerName } from "./player-name";

/**
 * Staff of the shop whose slug the page bound. Hiring, firing and changing ranks need
 * staff.manage (the owner has it): requireSellerShop 404s for anybody else. Someone who is not
 * the owner can neither give a rank with staff.manage nor touch a member who has it.
 */

/** Result of the add form; `name` is what was typed, to keep it in the field after an error. */
export type EmployeeFormState = { status: "idle" | "added" | "error"; message: string | null; name: string };

function failed(message: string, name = ""): EmployeeFormState {
  return { status: "error", message, name };
}

/**
 * Adds an employee (shop_members) with the chosen rank (the default one if none). The player must
 * exist in players, i.e. they have joined the game server at least once.
 */
export async function addEmployeeAction(
  shopSlug: string,
  _state: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const t = m.roleplay.employees;
  const { player, shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "empleados"), { permission: "staff.manage" });
  const raw = formData.get("name");
  const typed = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!canEditShop(shop.status)) return failed(t.errors.suspended, typed);

  const name = parsePlayerName(typed);
  if (!name) return failed(t.errors.format, typed);

  let added: string;
  try {
    const roles = await getShopRoles(shop.id);
    const roleId = formData.get("role");
    const role = isUuid(roleId) ? roles.find((candidate) => candidate.id === roleId) : roles.find((candidate) => candidate.isDefault);
    if (!role) return failed(t.errors.role, typed);
    if (!canAssignRole(staffActor(shop), role.permissions)) return failed(t.errors.roleForbidden, typed);

    const target = await findPlayerByName(name);
    if (!target) return failed(fmt(t.errors.notFound, { name }), typed);
    // The owner can always use the company computer.
    if (target.uuid === shop.ownerUuid) return failed(t.errors.owner, typed);
    // A player can only work for a few shops (plugin_settings.max_shop_memberships).
    const memberships = await getMemberships(target.uuid);
    if (memberships.free === 0) {
      return failed(fmt(t.errors.limit, { name: target.name, max: memberships.max }), typed);
    }
    const result = await addShopMember(shop.id, target.uuid, player.uuid, role.id);
    if (result === "exists") return failed(fmt(t.errors.exists, { name: target.name }), typed);
    if (result === "limit") return failed(fmt(t.errors.limit, { name: target.name, max: memberships.max }), typed);
    added = target.name;
  } catch (error) {
    console.error("addEmployeeAction", error);
    return failed(t.errors.generic, typed);
  }

  refresh();
  return { status: "added", message: fmt(t.add.added, { name: added }), name: "" };
}

/** Fires an employee, unless the actor may not touch them (see canManageMember). */
export async function removeEmployeeAction(shopSlug: string, formData: FormData): Promise<void> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "empleados"), { permission: "staff.manage" });
  const playerUuid = formData.get("player");
  if (!isUuid(playerUuid) || !canEditShop(shop.status)) return;

  const member = await getShopMember(shop.id, playerUuid);
  if (!member || !canManageMember(staffActor(shop), member.role?.permissions ?? [])) return;
  await removeShopMember(shop.id, playerUuid);
  refresh();
}

/** Gives an employee another rank of the shop (same rules as hiring and firing). */
export async function changeMemberRoleAction(shopSlug: string, formData: FormData): Promise<void> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "empleados"), { permission: "staff.manage" });
  const playerUuid = formData.get("player");
  const roleId = formData.get("role");
  if (!isUuid(playerUuid) || !isUuid(roleId) || !canEditShop(shop.status)) return;

  const [member, roles] = await Promise.all([getShopMember(shop.id, playerUuid), getShopRoles(shop.id)]);
  const role = roles.find((candidate) => candidate.id === roleId);
  const actor = staffActor(shop);
  if (!member || !role || member.role?.id === role.id) return;
  if (!canManageMember(actor, member.role?.permissions ?? []) || !canAssignRole(actor, role.permissions)) return;
  await setMemberRole(shop.id, playerUuid, role.id);
  refresh();
}
