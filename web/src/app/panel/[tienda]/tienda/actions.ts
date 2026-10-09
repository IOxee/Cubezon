"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CATALOG_TAG } from "@/lib/data/catalog";
import {
  deleteShopMedia,
  getShopListings,
  isSlugTaken,
  replaceShopImage,
  requireSellerShop,
  updateShopDetails,
  updateShopProfile,
  uploadShopMedia,
  type SellerShop,
} from "@/lib/data/seller";
import { SHOPS_TAG, shopTag } from "@/lib/data/shops";
import { validateProfile, type ProfileField } from "@/lib/seller/profile";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { errorState, validateShop, type FormState, type ShopField } from "@/lib/seller/validation";
import {
  isShopMediaKind,
  isShopMediaPathOf,
  shopMediaPath,
  validateShopImage,
  type ShopImageState,
  type ShopMediaKind,
} from "@/lib/shop-media";

/** Settings and public profile: only the owner changes them (employees get a 404). */
const OWNER_ONLY = { ownerOnly: true } as const;

/**
 * Public data of an approved shop changed: the catalog (shop name and slug on every card), the
 * directory and the storefront under every slug given. Shops in review are not public yet.
 */
function updatePublicTags(shop: SellerShop, ...slugs: string[]) {
  if (shop.status !== "APPROVED") return;
  updateTag(CATALOG_TAG);
  updateTag(SHOPS_TAG);
  for (const slug of new Set([shop.slug, ...slugs])) updateTag(shopTag(slug));
}

/**
 * Shop details from the panel: name, slug, description and ink, at any time and without a new
 * review (a SUSPENDED shop is read only). The status does not change. The slug is bound by the
 * page and the shop is loaded again by slug and owner. A new slug moves the panel to a new URL;
 * the old one keeps leading to the storefront (shop_slug_history).
 */
export async function updateShopAction(
  shopSlug: string,
  _state: FormState<ShopField>,
  formData: FormData,
): Promise<FormState<ShopField>> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "tienda"), OWNER_ONLY);
  if (!canEditShop(shop.status)) return errorState({}, "suspended");

  const parsed = validateShop({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    ink: formData.get("ink"),
  });
  if (!parsed.ok) return errorState(parsed.errors);
  const { name, slug, description, ink } = parsed.value;

  try {
    if (slug !== shop.slug && (await isSlugTaken(slug, shop.id))) {
      return errorState({ slug: "slugTaken" });
    }
    // Also "slugTaken" when another shop used this slug before (trigger on shops).
    const result = await updateShopDetails(shop.id, { name, slug, description, ink });
    if (result === "slugTaken") return errorState({ slug: "slugTaken" });
  } catch (error) {
    console.error("updateShopAction", error);
    return errorState({}, "generic");
  }

  updatePublicTags(shop, slug);
  if (slug !== shop.slug) redirect(`${panelPath(slug, "tienda")}?aviso=guardado`);
  refresh();
  return { status: "saved", fieldErrors: {}, formError: null };
}

/** Public profile: tagline, up to four featured ACTIVE listings and whether to show the zone. */
export async function updateShopProfileAction(
  shopSlug: string,
  _state: FormState<ProfileField>,
  formData: FormData,
): Promise<FormState<ProfileField>> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "tienda"), OWNER_ONLY);
  if (!canEditShop(shop.status)) return errorState({}, "suspended");

  try {
    const listings = await getShopListings(shop.id);
    const active = listings.filter((listing) => listing.status === "ACTIVE").map((listing) => listing.id);
    const parsed = validateProfile(
      {
        tagline: formData.get("tagline"),
        featured: formData.getAll("featured"),
        showLocation: formData.get("showLocation"),
      },
      active,
    );
    if (!parsed.ok) return errorState(parsed.errors);
    await updateShopProfile(shop.id, parsed.value);
  } catch (error) {
    console.error("updateShopProfileAction", error);
    return errorState({}, "generic");
  }

  updatePublicTags(shop);
  refresh();
  return { status: "saved", fieldErrors: {}, formError: null };
}

function imageError(error: ShopImageState["error"]): ShopImageState {
  return { status: "error", error };
}

/** The previous image of the shop is deleted from the bucket after the switch (never fatal). */
async function deleteOldImage(shop: SellerShop, path: string | null) {
  if (!isShopMediaPathOf(shop.id, path)) return;
  try {
    await deleteShopMedia([path]);
  } catch (error) {
    console.error("deleteOldImage", error);
  }
}

/**
 * Logo or banner of the shop: uploads a new image (field "image") or, with intent=remove, takes
 * it off. The file is checked here again (type, size and magic bytes) and only then uploaded
 * with the secret key to shops/<shopId>/<kind>-<timestamp>.<ext>; the old file is deleted.
 */
export async function shopImageAction(
  shopSlug: string,
  kind: ShopMediaKind,
  _state: ShopImageState,
  formData: FormData,
): Promise<ShopImageState> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "tienda"), OWNER_ONLY);
  if (!isShopMediaKind(kind)) return imageError("generic");
  if (!canEditShop(shop.status)) return imageError("suspended");
  const previous = kind === "logo" ? shop.logoPath : shop.bannerPath;

  if (formData.get("intent") === "remove") {
    try {
      if (previous !== null && !(await replaceShopImage(shop.id, kind, previous, null))) return imageError("generic");
    } catch (error) {
      console.error("shopImageAction remove", error);
      return imageError("generic");
    }
    await deleteOldImage(shop, previous);
    updatePublicTags(shop);
    refresh();
    return { status: "removed", error: null };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return imageError("imageMissing");
  let uploaded: string | null = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = validateShopImage({ type: file.type, size: file.size }, bytes);
    if (!image.ok) return imageError(image.error);

    const path = shopMediaPath(shop.id, kind, Date.now(), image.value.extension);
    await uploadShopMedia(path, bytes, image.value.contentType);
    uploaded = path;
    // False when another upload changed the image meanwhile: that one stays, ours goes.
    if (!(await replaceShopImage(shop.id, kind, previous, path))) throw new Error("Shop image changed meanwhile");
  } catch (error) {
    console.error("shopImageAction upload", error);
    if (uploaded) await deleteOldImage(shop, uploaded);
    return imageError("generic");
  }
  await deleteOldImage(shop, previous);
  updatePublicTags(shop);
  refresh();
  return { status: "saved", error: null };
}
