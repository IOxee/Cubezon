"use server";

import { refresh } from "next/cache";
import { requirePlayer } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/catalog";
import { createShop, getOwnShops, isSlugTaken, resubmitShop } from "@/lib/data/seller";
import { getShopSlots } from "@/lib/data/shop-slots";
import { canRequestShop } from "@/lib/seller/shops";
import { errorState, validateShop, type FormState, type ShopField } from "@/lib/seller/validation";

function parseShopForm(formData: FormData) {
  return validateShop({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    ink: formData.get("ink"),
  });
}

const SAVED: FormState<ShopField> = { status: "saved", fieldErrors: {}, formError: null };

/**
 * Request for a new shop (always PENDING). A player can have as many shops (open, in review or
 * suspended; rejected ones do not count) as their shop slots. Checked here for a clear message;
 * the shops_check_slots trigger has the last word ("slotsExceeded").
 */
export async function requestShopAction(
  _state: FormState<ShopField>,
  formData: FormData,
): Promise<FormState<ShopField>> {
  const player = await requirePlayer("/sell");
  const parsed = parseShopForm(formData);
  if (!parsed.ok) return errorState(parsed.errors);

  try {
    if (!canRequestShop(await getShopSlots(player.uuid))) return errorState({}, "shopLimit");
    if (await isSlugTaken(parsed.value.slug)) return errorState({ slug: "slugTaken" });
    const result = await createShop(player.uuid, parsed.value);
    if (result === "slugTaken") return errorState({ slug: "slugTaken" });
    if (result === "slotsExceeded") return errorState({}, "shopLimit");
  } catch (error) {
    console.error("requestShopAction", error);
    return errorState({}, "generic");
  }

  // The new request shows up in "Tus tiendas". Pending shops are not public: no tag to update.
  refresh();
  return SAVED;
}

/**
 * Corrected request of one REJECTED shop of the player (its id is bound by the page): back to
 * PENDING. It takes a slot again, so it needs a free one.
 */
export async function resubmitShopAction(
  shopId: string,
  _state: FormState<ShopField>,
  formData: FormData,
): Promise<FormState<ShopField>> {
  const player = await requirePlayer("/sell");
  if (!isUuid(shopId)) return errorState({}, "shopNotFound");
  const parsed = parseShopForm(formData);
  if (!parsed.ok) return errorState(parsed.errors);

  try {
    const shops = await getOwnShops(player.uuid);
    const shop = shops.find((candidate) => candidate.id === shopId);
    if (!shop) return errorState({}, "shopNotFound");
    if (shop.status !== "REJECTED") return errorState({}, "notRejected");
    if (!canRequestShop(await getShopSlots(player.uuid))) return errorState({}, "shopLimit");
    if (await isSlugTaken(parsed.value.slug, shop.id)) return errorState({ slug: "slugTaken" });

    const result = await resubmitShop(player.uuid, shop.id, parsed.value);
    if (result === "slugTaken") return errorState({ slug: "slugTaken" });
    if (result === "slotsExceeded") return errorState({}, "shopLimit");
    if (result === "conflict") return errorState({}, "notRejected");
  } catch (error) {
    console.error("resubmitShopAction", error);
    return errorState({}, "generic");
  }

  refresh();
  return SAVED;
}
