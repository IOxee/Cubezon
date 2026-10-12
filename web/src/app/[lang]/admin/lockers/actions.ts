"use server";

import { refresh, updateTag } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { fmt } from "@/i18n";
import { getActionMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { setLockerActive } from "@/lib/data/admin";
import { isUuid } from "@/lib/data/catalog";

/** Turns a locker on or off for checkout and the public list. Lockers are created in-game. */
export async function setLockerActiveAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.lockers;
  await requireStaff();

  const lockerId = formData.get("lockerId");
  const active = formData.get("active");
  if (!isUuid(lockerId) || (active !== "true" && active !== "false")) {
    return { status: "error", message: t.errors.invalid };
  }

  const locker = await setLockerActive(lockerId, active === "true");
  if (!locker) {
    refresh();
    return { status: "error", message: t.errors.notFound };
  }

  updateTag("lockers");
  return { status: "ok", message: fmt(active === "true" ? t.done.on : t.done.off, { name: locker.name }) };
}
