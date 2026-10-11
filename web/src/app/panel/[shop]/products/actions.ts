"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CATALOG_TAG, isUuid } from "@/lib/data/catalog";
import {
  countOpenOrders,
  createListing,
  getShopListing,
  requireSellerShop,
  restoreListing,
  setListingStatus,
  updateListing,
  type SellerShop,
} from "@/lib/data/seller";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop, canRemoveListing, isListingFormatLocked, type ListingStatus } from "@/lib/seller/stats";
import { errorState, itemInputValue, validateListing, type FormState, type ListingField } from "@/lib/seller/validation";
import { getCustomItemOptions } from "@/lib/data/custom-items";

/** Only approved shops are in the public catalog: refresh it when one of their listings changes. */
function updateCatalog(shop: SellerShop, listingId: string | null): void {
  if (shop.status !== "APPROVED") return;
  updateTag(CATALOG_TAG);
  if (listingId) updateTag(`listing:${listingId}`);
}

/**
 * Creates a listing (no id) or updates one of the shop. The slug is bound by the page; the shop
 * is loaded again by slug and owner, so a listing of someone else's shop is never touched.
 */
export async function saveListingAction(
  shopSlug: string,
  _state: FormState<ListingField>,
  formData: FormData,
): Promise<FormState<ListingField>> {
  const rawId = formData.get("id");
  const listingId = typeof rawId === "string" && rawId !== "" ? rawId : null;
  const { shop } = await requireSellerShop(
    shopSlug,
    listingId ? panelPath(shopSlug, "products", listingId) : panelPath(shopSlug, "products", "new"),
    { permission: "products.manage" },
  );
  if (!canEditShop(shop.status)) return errorState({}, "suspended");
  if (listingId !== null && !isUuid(listingId)) return errorState({}, "notFound");

  const current = listingId ? await getShopListing(shop.id, listingId) : null;
  if (listingId && !current) return errorState({}, "notFound");
  if (current?.status === "REMOVED") return errorState({}, "removed");
  // Deposited units must keep matching the listing: the form disables these fields, and the
  // stored values are used whatever was posted. New formats must fit in one stack (plugin 0.0.6).
  const keepFormat = current ? isListingFormatLocked(current) : false;

  const parsed = validateListing(
    {
      title: formData.get("title"),
      description: formData.get("description"),
      item: current && keepFormat ? itemInputValue(current) : formData.get("item"),
      unitAmount: current && keepFormat ? String(current.unitAmount) : formData.get("unitAmount"),
      unitPrice: formData.get("unitPrice"),
      status: formData.get("status"),
    },
    { formatLocked: keepFormat, customItems: keepFormat ? [] : await getCustomItemOptions() },
  );
  if (!parsed.ok) return errorState(parsed.errors);

  let savedId: string;
  try {
    if (current) {
      const updated = await updateListing(shop.id, current.id, parsed.value);
      if (!updated) return errorState({}, "notFound");
      savedId = current.id;
    } else {
      savedId = await createListing(shop.id, parsed.value);
    }
  } catch (error) {
    console.error("saveListingAction", error);
    return errorState({}, "generic");
  }

  updateCatalog(shop, current ? savedId : null);
  redirect(`${panelPath(shop.slug, "products")}?notice=${current ? "saved" : "created"}`);
}

const STATUSES: readonly ListingStatus[] = ["ACTIVE", "PAUSED", "REMOVED"];

/** Pause, activate or remove a listing of the shop whose slug the page bound (restoreListingAction undoes a removal). */
export async function changeListingStatusAction(shopSlug: string, formData: FormData): Promise<void> {
  const id = formData.get("id");
  const status = formData.get("status");
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "products"), { permission: "products.manage" });
  if (!isUuid(id) || !STATUSES.includes(status as ListingStatus) || !canEditShop(shop.status)) return;

  const listing = await getShopListing(shop.id, id);
  if (!listing || listing.status === "REMOVED" || listing.status === status) return;
  if (status === "REMOVED" && !canRemoveListing({ ...listing, openOrders: await countOpenOrders(id) })) return;

  await setListingStatus(shop.id, id, status as ListingStatus);
  updateCatalog(shop, id);
  refresh();
}

/** Brings a removed listing of the shop back (paused) and opens it so the seller can review it. */
export async function restoreListingAction(shopSlug: string, formData: FormData): Promise<void> {
  const id = formData.get("id");
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "products"), { permission: "products.manage" });
  if (!isUuid(id) || !canEditShop(shop.status)) return;
  if (!(await restoreListing(shop.id, id))) return;

  updateCatalog(shop, id);
  redirect(`${panelPath(shop.slug, "products", id)}?notice=restored`);
}
