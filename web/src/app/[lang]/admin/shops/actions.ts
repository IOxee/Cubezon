"use server";

import { refresh, updateTag } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { fmt } from "@/i18n";
import { getActionMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { REVIEW_NOTE_MAX, isShopDecision, reviewShop, setShopOfficial } from "@/lib/data/admin";
import { isUuid } from "@/lib/data/catalog";

function fail(message: string): ActionState {
  return { status: "error", message };
}

/** Shop status and the official flag are public (catalog, directory, shop pages). */
function invalidatePublicShops() {
  updateTag("catalog");
  updateTag("shops");
}

/** Approve, reject (note required), suspend or reactivate a shop. */
export async function reviewShopAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.shops;
  const reviewer = await requireStaff();

  const shopId = formData.get("shopId");
  const decision = formData.get("decision");
  const rawNote = formData.get("note");
  if (!isUuid(shopId) || !isShopDecision(decision) || (rawNote !== null && typeof rawNote !== "string")) {
    return fail(t.errors.invalid);
  }

  const note = (rawNote ?? "").replace(/\r\n/g, "\n").trim();
  if ([...note].length > REVIEW_NOTE_MAX) return fail(fmt(t.errors.noteTooLong, { max: REVIEW_NOTE_MAX }));
  if (decision === "reject" && !note) return fail(t.errors.noteRequired);

  const shop = await reviewShop(reviewer, shopId, decision, note || null);
  if (!shop) {
    // Someone else changed it first: show the current state.
    refresh();
    return fail(t.errors.stale);
  }

  invalidatePublicShops();
  return { status: "ok", message: fmt(t.done[decision], { name: shop.name }) };
}

/** Marks or unmarks a shop as official (Cubezon's own). Superadmin only. */
export async function setShopOfficialAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.shops;
  await requireStaff("SUPERADMIN");

  const shopId = formData.get("shopId");
  const official = formData.get("official");
  if (!isUuid(shopId) || (official !== "true" && official !== "false")) return fail(t.errors.invalid);

  const shop = await setShopOfficial(shopId, official === "true");
  if (!shop) {
    refresh();
    return fail(t.errors.notFound);
  }

  invalidatePublicShops();
  return {
    status: "ok",
    message: fmt(official === "true" ? t.done.officialOn : t.done.officialOff, { name: shop.name }),
  };
}
