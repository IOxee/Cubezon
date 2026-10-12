/**
 * English names of game items. Minecraft's English names are the material id in title case
 * ("diamond_sword" -> "Diamond Sword"), so only the exceptions are listed.
 */
const EXCEPTIONS: Record<string, string> = {
  tnt: "TNT",
  tnt_minecart: "Minecart with TNT",
  chest_minecart: "Minecart with Chest",
  furnace_minecart: "Minecart with Furnace",
  hopper_minecart: "Minecart with Hopper",
  experience_bottle: "Bottle o' Enchanting",
  map: "Empty Map",
  filled_map: "Map",
  writable_book: "Book and Quill",
  cod_bucket: "Bucket of Cod",
  salmon_bucket: "Bucket of Salmon",
  tropical_fish_bucket: "Bucket of Tropical Fish",
  pufferfish_bucket: "Bucket of Pufferfish",
  axolotl_bucket: "Bucket of Axolotl",
  tadpole_bucket: "Bucket of Tadpole",
};

/** Words Minecraft keeps in lower case inside a name ("Heart of the Sea"). */
const SMALL_WORDS = new Set(["of", "the", "and", "on", "a", "with", "o'"]);

/** English name of a material id. */
export function itemName(material: string): string {
  const known = EXCEPTIONS[material];
  if (known) return known;
  return material
    .split("_")
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
