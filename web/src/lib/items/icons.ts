import { supabaseUrl } from "@/lib/supabase/url";

/** URL of the original game icon for a material id. Configurable with NEXT_PUBLIC_ITEM_ICON_URL ({id} placeholder). */
const ICON_URL = process.env.NEXT_PUBLIC_ITEM_ICON_URL ?? "https://mc.nerothe.com/img/1.21.11/minecraft_{id}.png";

/** Public Storage bucket with the icons of custom items (uploaded by staff on the web). */
export const ITEM_ICONS_BUCKET = "item-icons";

export function itemIconUrl(material: string): string {
  return ICON_URL.replace("{id}", encodeURIComponent(material));
}

/** Public URL of an icon of the item-icons bucket, or null when there is none. */
export function customIconUrl(
  path: string | null | undefined,
  baseUrl: string | undefined = supabaseUrl(),
): string | null {
  if (!path || !baseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${ITEM_ICONS_BUCKET}/${encoded}`;
}

/**
 * Icon of what a listing sells: the uploaded icon of its custom item when there is one,
 * otherwise the game icon of its vanilla base material.
 */
export function itemIconSrc(
  item: { material: string; customIconPath?: string | null },
  baseUrl: string | undefined = supabaseUrl(),
): string {
  return customIconUrl(item.customIconPath, baseUrl) ?? itemIconUrl(item.material);
}
