"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { fmt, plural } from "@/i18n";
import { getActionMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/catalog";
import { getShopSlots, setPlayerShopSlots } from "@/lib/data/shop-slots";
import { isOverShopSlots, parseShopSlotsInput } from "@/lib/seller/shops";

function fail(message: string): ActionState {
  return { status: "error", message };
}

/**
 * Sets a player's shop slots (0-100) or, with "reset", sends them back to the default.
 * Their shops are never touched: below their shops in use, they just cannot request more.
 * Superadmin only.
 */
export async function setShopSlotsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.players;
  await requireStaff("SUPERADMIN");

  const playerUuid = formData.get("playerUuid");
  if (!isUuid(playerUuid)) return fail(t.errors.invalid);
  const slots = parseShopSlotsInput(formData.get("slots"));
  if (slots === undefined) return fail(t.errors.slots);

  const name = await setPlayerShopSlots(playerUuid, slots);
  refresh();
  if (name === null) return fail(t.errors.gone);

  const now = await getShopSlots(playerUuid);
  const done = plural(now.slots, slots === null ? t.done.reset : t.done.set, { name });
  const over = isOverShopSlots(now) ? ` ${fmt(t.done.over, { used: now.used })}` : "";
  return { status: "ok", message: `${done}${over}` };
}
