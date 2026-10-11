"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { fmt, m } from "@/i18n";
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

const t = m.admin.team;

/** uuids compare case-insensitively in Postgres, so do the same here. */
function isSelf(playerUuid: string, me: { uuid: string }): boolean {
  return playerUuid.toLowerCase() === me.uuid.toLowerCase();
}

function fail(message: string): ActionState {
  return { status: "error", message };
}

/** Adds a player (who has joined the server at least once) to the staff. Superadmin only. */
export async function addStaffAction(_state: ActionState, formData: FormData): Promise<ActionState> {
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

/** Changes another member's role. Nobody can change their own. Superadmin only. */
export async function setStaffRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireStaff("SUPERADMIN");

  const playerUuid = formData.get("playerUuid");
  const role = formData.get("role");
  if (!isUuid(playerUuid) || !isStaffRole(role)) return fail(t.errors.invalid);
  if (isSelf(playerUuid, me)) return fail(t.errors.self);

  const name = await setStaffRole(playerUuid, role);
  refresh();
  if (name === null) return fail(t.errors.gone);
  return { status: "ok", message: fmt(t.done.role, { name, role: m.status.staff[role] }) };
}

/** Removes another member from the staff. Nobody can remove themselves. Superadmin only. */
export async function removeStaffAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireStaff("SUPERADMIN");

  const playerUuid = formData.get("playerUuid");
  if (!isUuid(playerUuid)) return fail(t.errors.invalid);
  if (isSelf(playerUuid, me)) return fail(t.errors.self);

  const name = await removeStaff(playerUuid);
  refresh();
  if (name === null) return fail(t.errors.gone);
  return { status: "ok", message: fmt(t.done.removed, { name }) };
}
