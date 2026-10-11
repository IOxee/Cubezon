"use server";

import { refresh, updateTag } from "next/cache";
import { CATALOG_TAG, isUuid } from "@/lib/data/catalog";
import {
  deleteListingPhotos,
  getShopListing,
  replaceListingPhoto,
  requireSellerShop,
  uploadListingPhoto,
} from "@/lib/data/seller";
import { isListingPhotoPathOf, listingPhotoPath } from "@/lib/listing-photos";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { validateShopImage, type ShopImageState } from "@/lib/shop-media";

function photoError(error: ShopImageState["error"]): ShopImageState {
  return { status: "error", error };
}

/** Deletes a file of this listing's photos; a leftover file is never worth failing the action. */
async function deleteOldPhoto(listingId: string, path: string | null) {
  if (!isListingPhotoPathOf(listingId, path)) return;
  try {
    await deleteListingPhotos([path]);
  } catch (error) {
    console.error("deleteOldPhoto", error);
  }
}

/**
 * Photo of a product: uploads a new one (field "image") or, with intent=remove, takes it off. Owner
 * or staff with products.manage (checked again here, shop loaded by slug). The file is checked
 * (type, size and magic bytes) before it is uploaded with the secret key to
 * listings/<id>/photo-<timestamp>.<ext>; the old file is deleted afterwards.
 */
export async function listingPhotoAction(
  shopSlug: string,
  listingId: string,
  _state: ShopImageState,
  formData: FormData,
): Promise<ShopImageState> {
  if (!isUuid(listingId)) return photoError("generic");
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "productos", listingId), {
    permission: "products.manage",
  });
  if (!canEditShop(shop.status)) return photoError("suspended");
  const listing = await getShopListing(shop.id, listingId);
  if (!listing || listing.status === "REMOVED") return photoError("generic");
  const previous = listing.photoPath;

  if (formData.get("intent") === "remove") {
    try {
      if (previous !== null && !(await replaceListingPhoto(shop.id, listingId, previous, null))) return photoError("generic");
    } catch (error) {
      console.error("listingPhotoAction remove", error);
      return photoError("generic");
    }
    await deleteOldPhoto(listingId, previous);
    afterChange(shop.status, listingId);
    return { status: "removed", error: null };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return photoError("imageMissing");
  let uploaded: string | null = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = validateShopImage({ type: file.type, size: file.size }, bytes);
    if (!image.ok) return photoError(image.error);

    const path = listingPhotoPath(listingId, Date.now(), image.value.extension);
    await uploadListingPhoto(path, bytes, image.value.contentType);
    uploaded = path;
    // False when another upload changed the photo meanwhile: that one stays, ours goes.
    if (!(await replaceListingPhoto(shop.id, listingId, previous, path))) throw new Error("Listing photo changed meanwhile");
  } catch (error) {
    console.error("listingPhotoAction upload", error);
    if (uploaded) await deleteOldPhoto(listingId, uploaded);
    return photoError("generic");
  }
  await deleteOldPhoto(listingId, previous);
  afterChange(shop.status, listingId);
  return { status: "saved", error: null };
}

/** The catalog only shows approved shops; the panel always refreshes. */
function afterChange(status: string, listingId: string) {
  if (status === "APPROVED") {
    updateTag(CATALOG_TAG);
    updateTag(`listing:${listingId}`);
  }
  refresh();
}
