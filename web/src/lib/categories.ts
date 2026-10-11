import { m } from "@/i18n";
import { keyFromSlug } from "@/lib/url-slug";

/** Catalog categories. The database computes them with public.material_category(material). */
export const CATEGORY_KEYS = [
  "blocks",
  "tools",
  "combat",
  "armor",
  "food",
  "magic",
  "redstone",
  "decoration",
  "materials",
  "misc",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Material whose icon represents each category. */
export const CATEGORY_ICON: Record<CategoryKey, string> = {
  blocks: "grass_block",
  tools: "iron_pickaxe",
  combat: "diamond_sword",
  armor: "iron_chestplate",
  food: "apple",
  magic: "potion",
  redstone: "redstone",
  decoration: "lantern",
  materials: "gold_ingot",
  misc: "bundle",
};

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === "string" && (CATEGORY_KEYS as readonly string[]).includes(value);
}

export function categoryName(key: CategoryKey): string {
  return m.categories[key].name;
}

/** URL slug of ?category= (the key itself, see keySlug) -> key. */
export function categoryFromSlug(slug: string | undefined): CategoryKey | null {
  return keyFromSlug(CATEGORY_KEYS, slug);
}
