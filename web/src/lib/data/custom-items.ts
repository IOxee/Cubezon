import "server-only";

import { ITEM_ICONS_BUCKET } from "@/lib/items/icons";
import { isValidItemKey, isVanillaItemKey } from "@/lib/items/keys";
import type { CustomItemOption } from "@/lib/seller/validation";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";

/**
 * Items of other plugins and mods (custom_items): an admin registers them in the game with
 * /cz item register while holding one, and staff uploads their icons on the web (bucket
 * item-icons). The table is public (RLS): the seller form and the catalog read it with the
 * publishable key. The `sample` column (a serialized ItemStack) is never read here.
 * Reads are uncached: registering happens in the game, which cannot invalidate web tags.
 */

const OPTION_COLUMNS = "key, display_name, base_material, max_stack, icon_path";

type OptionRow = {
  key: string;
  display_name: string;
  base_material: string;
  max_stack: number;
  icon_path: string | null;
};

function toOption(row: OptionRow): CustomItemOption {
  return {
    key: row.key,
    name: row.display_name,
    material: row.base_material,
    maxStack: row.max_stack,
    iconPath: row.icon_path,
  };
}

/** Every registered custom item, by name: what the listing form offers next to vanilla items. */
export async function getCustomItemOptions(): Promise<CustomItemOption[]> {
  const { data, error } = await publicDb()
    .from("custom_items")
    .select(OPTION_COLUMNS)
    .order("display_name")
    .order("key");
  if (error) throw dbError(error);
  return data.map(toOption);
}

/** Registered custom items among the given item keys (vanilla keys are skipped), by key. */
export async function getCustomItemsByKeys(keys: readonly string[]): Promise<Map<string, CustomItemOption>> {
  const wanted = [...new Set(keys.filter((key) => !isVanillaItemKey(key)))];
  if (wanted.length === 0) return new Map();
  const { data, error } = await publicDb().from("custom_items").select(OPTION_COLUMNS).in("key", wanted);
  if (error) throw dbError(error);
  return new Map(data.map((row) => [row.key, toOption(row)]));
}

// Admin (/admin/objetos): call only after requireStaff()

export type AdminCustomItem = CustomItemOption & {
  /** What recognised the item in the game: itemsadder, nexo, mmoitems, pdc… */
  source: string;
  registeredBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Every custom item with who registered it, newest first. */
export async function listCustomItems(): Promise<AdminCustomItem[]> {
  const { data, error } = await adminDb()
    .from("custom_items")
    .select(`${OPTION_COLUMNS}, source, created_at, updated_at, registered:players(name)`)
    .order("created_at", { ascending: false })
    .order("key");
  if (error) throw dbError(error);
  return data.map((row) => ({
    ...toOption(row),
    source: row.source,
    registeredBy: row.registered?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** One custom item by key (its current icon), or null if it is not registered. */
export async function getCustomItemIcon(key: string): Promise<{ key: string; iconPath: string | null } | null> {
  if (!isValidItemKey(key)) return null;
  const { data, error } = await adminDb().from("custom_items").select("key, icon_path").eq("key", key).maybeSingle();
  if (error) throw dbError(error);
  return data ? { key: data.key, iconPath: data.icon_path } : null;
}

/**
 * Points the item's icon to another object of the bucket (null removes it), only while it
 * still points to `previous`: false if another upload changed it meanwhile.
 */
export async function replaceCustomItemIcon(key: string, previous: string | null, next: string | null): Promise<boolean> {
  let query = adminDb().from("custom_items").update({ icon_path: next }).eq("key", key);
  query = previous === null ? query.is("icon_path", null) : query.eq("icon_path", previous);
  const { data, error } = await query.select("key");
  if (error) throw dbError(error);
  return data.length > 0;
}

/** Uploads a checked icon (validateItemIcon) to the public bucket. Paths are never reused. */
export async function uploadItemIcon(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await adminDb()
    .storage.from(ITEM_ICONS_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw dbError(error);
}

export async function deleteItemIcons(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await adminDb().storage.from(ITEM_ICONS_BUCKET).remove(paths);
  if (error) throw dbError(error);
}
