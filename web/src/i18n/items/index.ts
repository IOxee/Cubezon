import type { Locale } from "../locales";
import { itemName as englishName } from "./en";
import { itemName as spanishName, itemNames as spanishNames } from "./es";

/** Name of a game item (material id) in the given language. */
export function itemName(material: string, locale: Locale): string {
  return locale === "es" ? spanishName(material) : englishName(material);
}

/** Known item ids with their name in the given language (suggestions in the product form). */
export function knownItemNames(locale: Locale): Record<string, string> {
  if (locale === "es") return spanishNames;
  return Object.fromEntries(Object.keys(spanishNames).map((id) => [id, englishName(id)]));
}
