import { supabaseUrl } from "@/lib/supabase/url";

/**
 * Product photos in the public Storage bucket "listing-photos". The owner or staff with
 * products.manage upload them from the seller panel; an admin can take any of them down. Same
 * limits and checks as the shop images (lib/shop-media: PNG, JPEG or WebP up to 2 MB, magic bytes).
 * Pure helpers, shared by the server and the client.
 */

export const LISTING_PHOTOS_BUCKET = "listing-photos";

/** listings/<listingId>/photo-<timestamp>.<ext>: a new name per upload, so caches never serve an old photo. */
export function listingPhotoPath(listingId: string, timestamp: number, extension: string): string {
  return `listings/${listingId}/photo-${Math.trunc(timestamp)}.${extension}`;
}

/** Whether a stored path is one of this listing's photos (only those are ever deleted). */
export function isListingPhotoPathOf(listingId: string, path: string | null | undefined): path is string {
  if (!path || !listingId) return false;
  const prefix = `listings/${listingId}/`;
  return path.startsWith(prefix) && /^photo-\d+\.(png|jpg|webp)$/.test(path.slice(prefix.length));
}

/** Public URL of a photo, or null when there is none. */
export function listingPhotoUrl(
  path: string | null | undefined,
  baseUrl: string | undefined = supabaseUrl(),
): string | null {
  if (!path || !baseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/${encoded}`;
}
