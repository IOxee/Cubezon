import "server-only";

import { deleteListingPhotos } from "@/lib/data/seller";
import { isListingPhotoPathOf } from "@/lib/listing-photos";
import { adminDb, dbError } from "@/lib/supabase/server";

/** /admin/fotos: product photos to moderate, newest first, and taking one down. */

export const LISTING_PHOTOS_PAGE_SIZE = 24;

export type AdminListingPhoto = {
  listingId: string;
  title: string;
  photoPath: string;
  uploadedAt: string | null;
  shop: { name: string; slug: string; status: string };
};

export async function listListingPhotos(page: number): Promise<{ photos: AdminListingPhoto[]; total: number }> {
  const from = (page - 1) * LISTING_PHOTOS_PAGE_SIZE;
  const { data, error, count } = await adminDb()
    .from("listings")
    .select("id, title, photo_path, photo_updated_at, shop:shops(name, slug, status)", { count: "exact" })
    .not("photo_path", "is", null)
    .order("photo_updated_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + LISTING_PHOTOS_PAGE_SIZE - 1);
  if (error) throw dbError(error);
  const photos = data.flatMap((row) =>
    row.photo_path === null || !row.shop
      ? []
      : [
          {
            listingId: row.id,
            title: row.title,
            photoPath: row.photo_path,
            uploadedAt: row.photo_updated_at,
            shop: { name: row.shop.name, slug: row.shop.slug, status: row.shop.status },
          },
        ],
  );
  return { photos, total: count ?? photos.length };
}

/**
 * Takes a listing's photo down (the product shows its icon again). Only clears the photo that is
 * there now, then deletes its file. Returns the shop status (for the catalog cache), or null when
 * there was no photo any more.
 */
export async function takeDownListingPhoto(listingId: string): Promise<{ shopStatus: string } | null> {
  const db = adminDb();
  const current = await db.from("listings").select("photo_path, shop:shops(status)").eq("id", listingId).maybeSingle();
  if (current.error) throw dbError(current.error);
  const path = current.data?.photo_path ?? null;
  if (path === null) return null;
  const { data, error } = await db
    .from("listings")
    .update({ photo_path: null, photo_updated_at: null })
    .eq("id", listingId)
    .eq("photo_path", path)
    .select("id");
  if (error) throw dbError(error);
  if (data.length === 0) return null;
  if (isListingPhotoPathOf(listingId, path)) {
    try {
      await deleteListingPhotos([path]);
    } catch (deleteError) {
      console.error("takeDownListingPhoto", deleteError);
    }
  }
  return { shopStatus: current.data?.shop?.status ?? "" };
}
