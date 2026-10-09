import { sniffImageType } from "@/lib/shop-media";

/**
 * Icons of custom items in the public bucket "item-icons". Pure helpers shared by the admin
 * Server Action (validation before the upload, object paths) and its form (quick checks before
 * sending a file). Only the server uploads, with the secret key, after requireStaff().
 */

/** Same limit as the bucket (file_size_limit: 512 KB). */
export const ITEM_ICON_MAX_BYTES = 512 * 1024;

/** Same list as the bucket (allowed_mime_types). */
export const ITEM_ICON_TYPES = ["image/png", "image/webp"] as const;
export type ItemIconType = (typeof ITEM_ICON_TYPES)[number];

/** For the accept attribute of the file input. */
export const ITEM_ICON_ACCEPT = ITEM_ICON_TYPES.join(",");

const EXTENSIONS: Record<ItemIconType, string> = { "image/png": "png", "image/webp": "webp" };

export type ItemIconError = "iconMissing" | "iconType" | "iconSize";

/** Result of the icon Server Action, for its form (useActionState). */
export type ItemIconState = {
  status: "idle" | "saved" | "removed" | "error";
  error: ItemIconError | "notFound" | "generic" | null;
};

export const IDLE_ICON_STATE: ItemIconState = { status: "idle", error: null };

function isItemIconType(value: unknown): value is ItemIconType {
  return typeof value === "string" && (ITEM_ICON_TYPES as readonly string[]).includes(value);
}

/** Cheap checks on what the browser says about the file: there is one, it fits, PNG or WebP. */
export function checkItemIconFile(file: { type: string; size: number }): ItemIconError | null {
  if (file.size <= 0) return "iconMissing";
  if (file.size > ITEM_ICON_MAX_BYTES) return "iconSize";
  if (!isItemIconType(file.type)) return "iconType";
  return null;
}

/**
 * Full check of an uploaded icon: declared type and size, and the bytes themselves (magic
 * numbers). The stored type comes from the bytes; anything that is not really a PNG or a WebP
 * (a JPEG, an SVG, a renamed file) is refused.
 */
export function validateItemIcon(
  file: { type: string; size: number },
  bytes: Uint8Array,
): { ok: true; value: { contentType: ItemIconType; extension: string } } | { ok: false; error: ItemIconError } {
  const quick = checkItemIconFile({ type: file.type, size: Math.max(file.size, bytes.length) });
  if (quick) return { ok: false, error: quick };
  const sniffed = sniffImageType(bytes);
  if (!isItemIconType(sniffed)) return { ok: false, error: "iconType" };
  return { ok: true, value: { contentType: sniffed, extension: EXTENSIONS[sniffed] } };
}

/** "itemsadder:Pack:Ruby" -> "itemsadder-pack-ruby": only lowercase letters, digits, _ and -. */
export function itemIconSlug(key: string): string {
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return slug || "item";
}

/** <sanitized key>-<timestamp>.<ext>: a new name per upload, so caches never serve an old icon. */
export function itemIconPath(key: string, timestamp: number, extension: string): string {
  return `${itemIconSlug(key)}-${Math.trunc(timestamp)}.${extension}`;
}

/** Whether a stored path is an icon uploaded for this key (only those are ever deleted). */
export function isItemIconPathOf(key: string, path: string | null | undefined): path is string {
  if (!path || !key) return false;
  const prefix = `${itemIconSlug(key)}-`;
  return path.startsWith(prefix) && /^\d+\.(png|webp)$/.test(path.slice(prefix.length));
}
