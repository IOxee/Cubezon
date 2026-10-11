"use server";

import { cookies } from "next/headers";
import { m } from "@/i18n";
import {
  CART_COOKIE,
  CART_COOKIE_OPTIONS,
  CART_MAX_LINES,
  MAX_UNITS_PER_LINE,
  addToCart,
  maxUnits,
  parseCart,
  parseUnits,
  removeFromCart,
  serializeCart,
  setCartUnits,
  type CartLine,
} from "@/lib/cart";
import { getCatalogItemsFresh, isUuid } from "@/lib/data/catalog";

/**
 * Cart actions. The cart is an anonymous cookie (no login needed); writing the cookie makes
 * Next.js re-render the current page, so the header count and the cart page update.
 */

export type AddToCartState =
  | { status: "idle" }
  | { status: "added"; listingId: string; units: number }
  | { status: "error"; listingId: string | null; message: string };

async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

async function writeCart(lines: CartLine[]): Promise<void> {
  (await cookies()).set(CART_COOKIE, serializeCart(lines), CART_COOKIE_OPTIONS);
}

/**
 * Buy box: adds units of a listing. Never beyond its current stock or 64 per line; when it does
 * not fit, nothing is added and the message does not reveal how many units are left.
 */
export async function addToCartAction(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const t = m.shopping.buyBox.errors;
  const rawId = formData.get("listingId");
  const units = parseUnits(formData.get("units"));
  if (!isUuid(rawId) || units === null) return { status: "error", listingId: null, message: t.invalid };
  const listingId = rawId.toLowerCase();

  const item = (await getCatalogItemsFresh([listingId])).get(listingId);
  if (!item) return { status: "error", listingId, message: t.unavailable };
  const max = maxUnits(item.unitsAvailable);
  if (max === 0) return { status: "error", listingId, message: t.soldOut };

  const lines = await readCart();
  const current = lines.find((line) => line.listingId === listingId)?.units ?? 0;
  if (current === 0 && lines.length >= CART_MAX_LINES) return { status: "error", listingId, message: t.cartFull };

  const target = current + units;
  if (target > MAX_UNITS_PER_LINE) return { status: "error", listingId, message: t.lineLimit };
  if (target > max) return { status: "error", listingId, message: t.notEnough };
  await writeCart(current > 0 ? setCartUnits(lines, listingId, target) : addToCart(lines, listingId, target));
  return { status: "added", listingId, units: target };
}

/** Cart page: sets the units of a line (1..64; the page warns when it exceeds the stock). */
export async function updateCartLineAction(formData: FormData): Promise<void> {
  const listingId = formData.get("listingId");
  const units = parseUnits(formData.get("units"));
  if (!isUuid(listingId) || units === null) return;
  const lines = await readCart();
  await writeCart(setCartUnits(lines, listingId, units));
}

export async function removeCartLineAction(formData: FormData): Promise<void> {
  const listingId = formData.get("listingId");
  if (!isUuid(listingId)) return;
  const lines = await readCart();
  await writeCart(removeFromCart(lines, [listingId]));
}
