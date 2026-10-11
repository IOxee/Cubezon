import { isInkKey, type InkKey } from "@/lib/inks";
import { isVanillaItemKey, VANILLA_NAMESPACE, vanillaItemKey } from "@/lib/items/keys";
import { maxStackSize } from "./stack";

/**
 * Pure validation of the seller forms (shop and listing), shared by the Server Actions and the
 * client forms. Mirrors the CHECK constraints of public.shops and public.listings; the server
 * always validates again, the client only uses it for previews.
 */

export const SHOP_NAME = { min: 3, max: 40 } as const;
export const SHOP_SLUG = { min: 3, max: 40 } as const;
export const SHOP_DESCRIPTION_MAX = 500;
export const LISTING_TITLE = { min: 3, max: 60 } as const;
export const LISTING_DESCRIPTION_MAX = 500;
export const MATERIAL_MAX = 64;
/** Longest text accepted in the item field (a vanilla id or the key of a custom item). */
export const ITEM_INPUT_MAX = 200;
/** Items per unit: one stack at most (the database allows up to 99). See maxUnitAmount(). */
export const UNIT_AMOUNT = { min: 1, max: 64 } as const;
/** Highest unit price, in cents (1.000.000.000,00): keeps price * 64 inside numeric(14, 2). */
export const MAX_PRICE_CENTS = 100_000_000_000;

/** Statuses a seller can pick in the listing form (REMOVED has its own action). */
export const EDITABLE_LISTING_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type EditableListingStatus = (typeof EDITABLE_LISTING_STATUSES)[number];

export type FieldErrorCode =
  | "nameLength"
  | "slugFormat"
  | "slugTaken"
  | "descriptionLength"
  | "inkInvalid"
  | "titleLength"
  | "materialFormat"
  | "itemUnknown"
  | "unitAmountRange"
  | "unitAmountStack"
  | "priceFormat"
  | "priceRange"
  | "statusInvalid"
  | "taglineLength"
  | "featuredTooMany"
  | "expressFeeFormat"
  | "expressFeeRange";

export type FormErrorCode =
  | "shopLimit"
  | "shopNotFound"
  | "notRejected"
  | "suspended"
  | "notFound"
  | "removed"
  | "expressFeeLocked"
  | "generic";

export type ShopField = "name" | "slug" | "description" | "ink";
/** The shop's own express fee (panel shop settings). */
export type ExpressFeeField = "expressFee";
export type ListingField = "title" | "description" | "item" | "unitAmount" | "unitPrice" | "status";

export type FieldErrors<F extends string> = Partial<Record<F, FieldErrorCode>>;

/** State returned by the seller Server Actions to their forms (useActionState). */
export type FormState<F extends string> = {
  status: "idle" | "saved" | "error";
  fieldErrors: FieldErrors<F>;
  formError: FormErrorCode | null;
};

export function idleState<F extends string>(): FormState<F> {
  return { status: "idle", fieldErrors: {}, formError: null };
}

export function errorState<F extends string>(
  fieldErrors: FieldErrors<F>,
  formError: FormErrorCode | null = null,
): FormState<F> {
  return { status: "error", fieldErrors, formError };
}

export type Result<T, F extends string> = { ok: true; value: T } | { ok: false; errors: FieldErrors<F> };

// Text helpers

/** Length in characters as Postgres char_length counts them (code points, not UTF-16 units). */
export function charLength(text: string): number {
  return [...text].length;
}

/** One-line text: trimmed, inner whitespace collapsed. */
export function cleanLine(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

/** Multi-line text: trimmed, CRLF normalised to LF (browsers send textareas with CRLF). */
export function cleanText(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
}

// Slug

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Minas Paco Ñ!" -> "minas-paco-n". Same alphabet as the shops.slug CHECK. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SHOP_SLUG.max)
    .replace(/-+$/, "");
}

/**
 * Light clean-up while the slug is being typed: keeps a trailing dash so "mi-" can become
 * "mi-tienda". The full slugify() runs on blur and on the server.
 */
export function slugDraft(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SHOP_SLUG.max);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= SHOP_SLUG.min && slug.length <= SHOP_SLUG.max && SLUG_PATTERN.test(slug);
}

// Price

/**
 * Parses a price typed by a Spanish seller into integer cents. Accepts "12", "12,5", "12.50",
 * "1.250" (thousands), "1.250,50" and spaces as thousands separators; at most 2 decimals.
 */
export function parsePriceCents(raw: unknown): { cents: number } | { error: "priceFormat" | "priceRange" } {
  if (typeof raw !== "string" && typeof raw !== "number") return { error: "priceFormat" };
  const text = String(raw)
    .replace(/[\s  ]/g, "")
    .replace(/\$$/, "");

  let decimal: string | null = null;
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    decimal = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+([.,]\d{1,2})?$/.test(text)) {
    decimal = text.replace(",", ".");
  }
  if (decimal === null) return { error: "priceFormat" };

  const [whole, fraction = ""] = decimal.split(".");
  if (whole.replace(/^0+/, "").length > 12) return { error: "priceRange" };
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_PRICE_CENTS) return { error: "priceRange" };
  return { cents };
}

/** Price for an input field, with a decimal comma and no grouping: 1250.5 -> "1250,50". */
export function priceInputValue(amount: number): string {
  const cents = Math.round(amount * 100);
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

// Material and unit amount

/** "Minecraft:Diamond Sword" -> "diamond_sword" (vanilla id without namespace). */
export function normalizeMaterial(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/[\s-]+/g, "_");
}

export function isValidMaterial(material: string): boolean {
  return material.length > 0 && material.length <= MATERIAL_MAX && /^[a-z0-9_]+$/.test(material);
}

/** Items per unit for an item that stacks to `maxStack`: one stack, never more than 64. */
export function stackUnitLimit(maxStack: number): number {
  const stack = Number.isFinite(maxStack) ? Math.trunc(maxStack) : UNIT_AMOUNT.max;
  return Math.min(UNIT_AMOUNT.max, Math.max(UNIT_AMOUNT.min, stack));
}

/** A unit is a single ItemStack: at most one full stack of the material (1, 16 or 64). */
export function maxUnitAmount(material: string): number {
  return stackUnitLimit(maxStackSize(material));
}

export function parseUnitAmount(raw: unknown): number | null {
  const text = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
  if (!/^\d{1,3}$/.test(text)) return null;
  const amount = Number(text);
  return amount >= UNIT_AMOUNT.min && amount <= UNIT_AMOUNT.max ? amount : null;
}

// Item of a listing: vanilla or custom (items of other plugins and mods)

/** A custom item a listing can sell (custom_items, registered by an admin in the game). */
export type CustomItemOption = {
  /** Namespaced key: nexo:ruby, itemsadder:pack:ruby, mmoitems:SWORD:FIRE_SWORD… */
  key: string;
  name: string;
  /** Vanilla base: icon fallback and category. */
  material: string;
  /** Max stack size of the item in the game (1..99). */
  maxStack: number;
  iconPath: string | null;
};

/** What a listing sells, as stored: listings.item_key, listings.material and the stack limit. */
export type ItemChoice = {
  /** What the deposit compares: minecraft:<material> or the key of the custom item. */
  itemKey: string;
  /** Vanilla id: the item itself, or the base of a custom item. */
  material: string;
  /** Highest items per unit: one stack of the item, at most 64. */
  maxUnitAmount: number;
  /** Name and icon of a custom item; null for vanilla items. */
  custom: { name: string; iconPath: string | null } | null;
};

function customChoice(item: CustomItemOption): ItemChoice {
  return {
    itemKey: item.key,
    material: item.material,
    maxUnitAmount: stackUnitLimit(item.maxStack),
    custom: { name: item.name, iconPath: item.iconPath },
  };
}

function namespaceOf(text: string): string | null {
  const colon = text.indexOf(":");
  return colon > 0 ? text.slice(0, colon).toLowerCase() : null;
}

/**
 * Resolves the item field of the listing form: the key of a registered custom item (exact, or
 * ignoring case when only one matches), or a vanilla id with or without "minecraft:". A key
 * with another namespace that nobody registered is "itemUnknown": an admin has to register it
 * in the game first. Anything else that is not a vanilla id is "materialFormat".
 */
export function resolveItemChoice(
  raw: unknown,
  customItems: readonly CustomItemOption[],
): { ok: true; value: ItemChoice } | { ok: false; error: "materialFormat" | "itemUnknown" } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "" || text.length > ITEM_INPUT_MAX) return { ok: false, error: "materialFormat" };

  const exact = customItems.find((item) => item.key === text);
  if (exact) return { ok: true, value: customChoice(exact) };

  const namespace = namespaceOf(text);
  if (namespace !== null && namespace !== VANILLA_NAMESPACE) {
    const lower = text.toLowerCase();
    const matches = customItems.filter((item) => item.key.toLowerCase() === lower);
    if (matches.length === 1) return { ok: true, value: customChoice(matches[0]) };
    return { ok: false, error: "itemUnknown" };
  }

  const material = normalizeMaterial(text);
  if (!isValidMaterial(material)) return { ok: false, error: "materialFormat" };
  return {
    ok: true,
    value: { itemKey: vanillaItemKey(material), material, maxUnitAmount: maxUnitAmount(material), custom: null },
  };
}

/** Value of the item field for a stored listing: the vanilla id, or the key of a custom item. */
export function itemInputValue(listing: { itemKey: string; material: string }): string {
  return isVanillaItemKey(listing.itemKey) ? listing.material : listing.itemKey;
}

// Forms

export type ShopInput = { name: string; slug: string; description: string; ink: InkKey };

export function validateShop(raw: {
  name: unknown;
  slug: unknown;
  description: unknown;
  ink: unknown;
}): Result<ShopInput, ShopField> {
  const errors: FieldErrors<ShopField> = {};

  const name = cleanLine(raw.name);
  if (charLength(name) < SHOP_NAME.min || charLength(name) > SHOP_NAME.max) errors.name = "nameLength";

  const slug = slugify(typeof raw.slug === "string" && raw.slug.trim() ? raw.slug : name);
  if (!isValidSlug(slug)) errors.slug = "slugFormat";

  const description = cleanText(raw.description);
  if (charLength(description) > SHOP_DESCRIPTION_MAX) errors.description = "descriptionLength";

  if (!isInkKey(raw.ink)) errors.ink = "inkInvalid";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, slug, description, ink: raw.ink as InkKey } };
}

/** Item and items per unit of a listing: fixed once anything was deposited. */
export type ListingFormat = { itemKey: string; material: string; unitAmount: number };

export type ListingInput = {
  title: string;
  description: string;
  priceCents: number;
  status: EditableListingStatus;
  /** Null when the format is locked: the update leaves item_key, material and unit_amount alone. */
  format: ListingFormat | null;
};

export function isEditableListingStatus(value: unknown): value is EditableListingStatus {
  return typeof value === "string" && (EDITABLE_LISTING_STATUSES as readonly string[]).includes(value);
}

/**
 * With formatLocked (anything was already deposited) the item and the items per unit are not
 * read nor checked: `format` comes back null and the update keeps the stored ones. Otherwise
 * the item is resolved against `customItems` and a unit must fit in one stack of it.
 */
export function validateListing(
  raw: {
    title: unknown;
    description: unknown;
    item: unknown;
    unitAmount: unknown;
    unitPrice: unknown;
    status: unknown;
  },
  {
    formatLocked = false,
    customItems = [],
  }: { formatLocked?: boolean; customItems?: readonly CustomItemOption[] } = {},
): Result<ListingInput, ListingField> {
  const errors: FieldErrors<ListingField> = {};

  const title = cleanLine(raw.title);
  if (charLength(title) < LISTING_TITLE.min || charLength(title) > LISTING_TITLE.max) errors.title = "titleLength";

  const description = cleanText(raw.description);
  if (charLength(description) > LISTING_DESCRIPTION_MAX) errors.description = "descriptionLength";

  let format: ListingFormat | null = null;
  if (!formatLocked) {
    const choice = resolveItemChoice(raw.item, customItems);
    const unitAmount = parseUnitAmount(raw.unitAmount);
    if (!choice.ok) errors.item = choice.error;
    if (unitAmount === null) errors.unitAmount = "unitAmountRange";
    else if (choice.ok && unitAmount > choice.value.maxUnitAmount) errors.unitAmount = "unitAmountStack";
    if (choice.ok && unitAmount !== null) {
      format = { itemKey: choice.value.itemKey, material: choice.value.material, unitAmount };
    }
  }

  const price = parsePriceCents(raw.unitPrice);
  if ("error" in price) errors.unitPrice = price.error;

  if (!isEditableListingStatus(raw.status)) errors.status = "statusInvalid";

  if (Object.keys(errors).length > 0 || "error" in price) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      description,
      priceCents: price.cents,
      status: raw.status as EditableListingStatus,
      format,
    },
  };
}
