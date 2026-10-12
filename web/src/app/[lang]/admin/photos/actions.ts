"use server";

import { refresh, updateTag } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { getActionMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { takeDownListingPhoto } from "@/lib/data/admin-photos";
import { CATALOG_TAG, isUuid } from "@/lib/data/catalog";

/** Takes a product photo down; the seller can upload another. Any staff member. */
export async function removeListingPhotoAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const m = await getActionMessages();
  const t = m.admin.photos;
  await requireStaff();

  const listingId = formData.get("listingId");
  if (!isUuid(listingId)) return { status: "error", message: t.gone };
  const removed = await takeDownListingPhoto(listingId);
  if (removed === null) {
    refresh();
    return { status: "error", message: t.gone };
  }
  if (removed.shopStatus === "APPROVED") {
    updateTag(CATALOG_TAG);
    updateTag(`listing:${listingId}`);
  }
  refresh();
  return { status: "ok", message: t.removed };
}
