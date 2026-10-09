/**
 * Item keys (listings.item_key, custom_items.key): a namespaced id the plugin computes from the
 * item and compares when depositing. Vanilla items are "minecraft:<material>"; items of other
 * plugins and mods keep their own namespace (nexo:ruby, itemsadder:pack:ruby, mmoitems:TYPE:ID).
 */

export const VANILLA_NAMESPACE = "minecraft";

/** Same pattern as the CHECK constraints of listings.item_key and custom_items.key. */
const ITEM_KEY_PATTERN = /^[a-z0-9_.-]+:[A-Za-z0-9_./:-]+$/;

export function isValidItemKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 200 && ITEM_KEY_PATTERN.test(key);
}

/** Key of a vanilla material: "diamond" -> "minecraft:diamond". */
export function vanillaItemKey(material: string): string {
  return `${VANILLA_NAMESPACE}:${material}`;
}

/** Whether a key is a vanilla item (its material is the item itself). */
export function isVanillaItemKey(key: string): boolean {
  return key.startsWith(`${VANILLA_NAMESPACE}:`);
}
