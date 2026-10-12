import { supabaseUrl } from "@/lib/supabase/url";

/**
 * Shop images (logo and banner) in the public Storage bucket "shop-media". Pure helpers shared
 * by the server (validation before the upload, object paths) and the client (quick checks
 * before sending a file, public URLs). Only the server uploads, with the secret key, after
 * checking that the player owns the shop.
 */

export const SHOP_MEDIA_BUCKET = "shop-media";

/** Same limit as the bucket (file_size_limit). Server Action bodies allow up to 3 MB. */
export const SHOP_MEDIA_MAX_BYTES = 2 * 1024 * 1024;

/** Same list as the bucket (allowed_mime_types). No SVG: it could carry scripts. */
export const SHOP_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ShopImageType = (typeof SHOP_IMAGE_TYPES)[number];

/** For the accept attribute of the file inputs. */
export const SHOP_IMAGE_ACCEPT = SHOP_IMAGE_TYPES.join(",");

const EXTENSIONS: Record<ShopImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Logo: square, shown in the shop seal. Banner: wide, on top of the storefront. */
export const SHOP_MEDIA_KINDS = ["logo", "banner"] as const;
export type ShopMediaKind = (typeof SHOP_MEDIA_KINDS)[number];

export function isShopMediaKind(value: unknown): value is ShopMediaKind {
  return typeof value === "string" && (SHOP_MEDIA_KINDS as readonly string[]).includes(value);
}

export function isShopImageType(value: unknown): value is ShopImageType {
  return typeof value === "string" && (SHOP_IMAGE_TYPES as readonly string[]).includes(value);
}

export type ShopImageError = "imageMissing" | "imageType" | "imageSize";

/** Result of the logo / banner Server Action, for its form (useActionState). */
export type ShopImageState = {
  status: "idle" | "saved" | "removed" | "error";
  error: ShopImageError | "suspended" | "generic" | null;
};

export const IDLE_IMAGE_STATE: ShopImageState = { status: "idle", error: null };

/**
 * Cheap checks on what the browser says about the file (before reading it): there is one,
 * it fits in the bucket and its declared type is allowed. The bytes are checked afterwards.
 */
export function checkImageFile(file: { type: string; size: number }): ShopImageError | null {
  if (file.size <= 0) return "imageMissing";
  if (file.size > SHOP_MEDIA_MAX_BYTES) return "imageSize";
  if (!isShopImageType(file.type)) return "imageType";
  return null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** Real type of an image from its first bytes (magic numbers), or null if it is none of ours. */
export function sniffImageType(bytes: Uint8Array): ShopImageType | null {
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

export type ValidImage = { contentType: ShopImageType; extension: string };

/**
 * Full check of an uploaded image: the declared type and size (checkImageFile) and the bytes
 * themselves. The stored type comes from the bytes, so a PNG renamed to .jpg is still saved
 * as a PNG; anything that is not really a PNG, JPEG or WebP is refused.
 */
export function validateShopImage(
  file: { type: string; size: number },
  bytes: Uint8Array,
): { ok: true; value: ValidImage } | { ok: false; error: ShopImageError } {
  const quick = checkImageFile({ type: file.type, size: Math.max(file.size, bytes.length) });
  if (quick) return { ok: false, error: quick };
  const contentType = sniffImageType(bytes);
  if (!contentType) return { ok: false, error: "imageType" };
  return { ok: true, value: { contentType, extension: EXTENSIONS[contentType] } };
}

/** shops/<shopId>/logo-<timestamp>.png: a new name per upload, so caches never serve an old image. */
export function shopMediaPath(shopId: string, kind: ShopMediaKind, timestamp: number, extension: string): string {
  return `shops/${shopId}/${kind}-${Math.trunc(timestamp)}.${extension}`;
}

/** Whether a stored path is one of this shop's images (only those are ever deleted). */
export function isShopMediaPathOf(shopId: string, path: string | null | undefined): path is string {
  if (!path || !shopId) return false;
  const prefix = `shops/${shopId}/`;
  return path.startsWith(prefix) && /^(logo|banner)-\d+\.(png|jpg|webp)$/.test(path.slice(prefix.length));
}

/** Public URL of an image of the bucket, or null when there is none. */
export function shopMediaUrl(
  path: string | null | undefined,
  baseUrl: string | undefined = supabaseUrl(),
): string | null {
  if (!path || !baseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/${encoded}`;
}
