"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/admin/action-form";
import { fmt } from "@/i18n";
import { getActionMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import {
  addStaff,
  findPlayerByName,
  isMinecraftName,
  isStaffRole,
  removeStaff,
  setStaffRole,
} from "@/lib/data/admin";
import { isUuid } from "@/lib/data/catalog";

/** uuids compare case-insensitively in Postgres, so do the same here. */
function isSelf(playerUuid: string, me: { uuid: string }): boolean {
  return playerUuid.toLowerCase() === me.uuid.toLowerCase();
}

function fail(message: string): ActionState {
  return { status: "error", message };
}

/** Adds a player (who has joined the server at least once) to the staff. Superadmin only. */
export async function addStaffAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.team;
  const me = await requireStaff("SUPERADMIN");

  const rawName = formData.get("name");
  const role = formData.get("role");
  if (typeof rawName !== "string" || !isStaffRole(role)) return fail(t.errors.invalid);
  const name = rawName.trim();
  if (!isMinecraftName(name)) return fail(t.errors.nameInvalid);

  const player = await findPlayerByName(name);
  if (!player) return fail(fmt(t.errors.notFound, { name }));
  if (isSelf(player.uuid, me)) return fail(t.errors.self);

  const added = await addStaff(me, player.uuid, role);
  if (!added) return fail(fmt(t.errors.exists, { name: player.name }));

  refresh();
  return { status: "ok", message: fmt(t.done.added, { name: player.name, role: m.status.staff[role] }) };
}

/**
 * Changes a member's role, the superadmin's own included. The database never lets the staff end
 * without a superadmin. Whoever steps down to admin leaves this page (it is superadmin only).
 */
export async function setStaffRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.team;
  const me = await requireStaff("SUPERADMIN");

  const playerUuid = formData.get("playerUuid");
  const role = formData.get("role");
  if (!isUuid(playerUuid) || !isStaffRole(role)) return fail(t.errors.invalid);

  const result = await setStaffRole(playerUuid, role);
  refresh();
  if (result.status === "lastSuperadmin") return fail(t.errors.lastSuperadmin);
  if (result.status === "gone") return fail(t.errors.gone);
  if (isSelf(playerUuid, me) && role !== "SUPERADMIN") redirect("/admin");
  return { status: "ok", message: fmt(t.done.role, { name: result.name, role: m.status.staff[role] }) };
}

/**
 * Removes a member from the staff, the superadmin themselves included (they lose access to the
 * administration). The database never lets the staff end without a superadmin.
 */
export async function removeStaffAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.team;
  const me = await requireStaff("SUPERADMIN");

  const playerUuid = formData.get("playerUuid");
  if (!isUuid(playerUuid)) return fail(t.errors.invalid);

  const result = await removeStaff(playerUuid);
  refresh();
  if (result.status === "lastSuperadmin") return fail(t.errors.lastSuperadmin);
  if (result.status === "gone") return fail(t.errors.gone);
  if (isSelf(playerUuid, me)) redirect("/");
  return { status: "ok", message: fmt(t.done.removed, { name: result.name }) };
}
