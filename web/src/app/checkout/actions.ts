"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fmt, m } from "@/i18n";
import { allowSelfPurchase } from "@/lib/dev-flags";
import { requirePlayer } from "@/lib/auth/session";
import {
  CART_COOKIE,
  CART_COOKIE_OPTIONS,
  parseCart,
  parseCheckoutLines,
  priceCheckout,
  removeFromCart,
  serializeCart,
} from "@/lib/cart";
import { isUuid } from "@/lib/data/catalog";
import { getExpressSettings, getMyMailboxes } from "@/lib/data/delivery";
import { createOrders, getCheckoutListings, isActiveLocker, type CheckoutDelivery } from "@/lib/data/orders";
import { parseDeliveryMethod } from "@/lib/delivery";
import { toCents } from "@/lib/format";
import { checkoutProblemText } from "@/components/shopping/checkout-problem";

export type PlaceOrderState = { error: string | null; details: string[] };

/**
 * Confirms the checkout: one PENDING order per line. Nothing from the form is trusted except
 * what the buyer asked for (listing, units, locker or mailbox) and the prices they saw (unit
 * prices and express fee): the session, the catalog, the stock, the shop owner, the locker, the
 * buyer's mailboxes and the express settings are all read again here. Payment happens later in
 * the game, when the plugin processes the order.
 */
export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const t = m.shopping.checkout;
  const player = await requirePlayer("/checkout");

  const request = parseCheckoutLines(formData.getAll("listingId"), formData.getAll("units"), formData.getAll("price"));
  if (!request) return { error: t.errors.invalid, details: [] };

  const delivery = await readDelivery(formData, player.uuid);
  if ("error" in delivery) {
    refresh();
    return { error: delivery.error, details: [] };
  }

  const { items, listings } = await getCheckoutListings(request.map((line) => line.listingId));

  const result = priceCheckout(request, listings, player.uuid, { allowOwnShop: allowSelfPurchase() });
  if (!result.ok) {
    // Re-render the page with fresh prices and stock so the buyer can review it.
    refresh();
    return {
      error: t.errors.review,
      details: result.problems.map((problem) =>
        fmt(t.problemLine, {
          title: items.get(problem.listingId)?.title ?? problem.listingId,
          problem: checkoutProblemText(problem),
        }),
      ),
    };
  }

  try {
    await createOrders(player, delivery, result.lines);
  } catch (error) {
    console.error("placeOrder: insert failed", error);
    return { error: t.errors.failed, details: [] };
  }

  if (formData.get("mode") === "cart") {
    const store = await cookies();
    const remaining = removeFromCart(
      parseCart(store.get(CART_COOKIE)?.value),
      result.lines.map((line) => line.listingId),
    );
    store.set(CART_COOKIE, serializeCart(remaining), CART_COOKIE_OPTIONS);
  }

  redirect(`/orders?new=${result.lines.length}`);
}

/** Locker or express delivery, checked against the database (and the fee the buyer saw). */
async function readDelivery(formData: FormData, playerUuid: string): Promise<CheckoutDelivery | { error: string }> {
  const t = m.shopping.checkout;
  if (parseDeliveryMethod(formData.get("delivery")) === "LOCKER") {
    const lockerId = formData.get("locker");
    if (!isUuid(lockerId) || !(await isActiveLocker(lockerId))) return { error: t.errors.locker };
    return { method: "LOCKER", lockerId };
  }

  const mailboxId = formData.get("mailbox");
  const [express, mailboxes] = await Promise.all([getExpressSettings(), getMyMailboxes(playerUuid)]);
  if (!express.enabled) return { error: t.errors.expressOff };
  if (!isUuid(mailboxId) || !mailboxes.some((mailbox) => mailbox.id === mailboxId)) return { error: t.errors.mailbox };
  const seenFee = Number(formData.get("expressFee"));
  if (!Number.isFinite(seenFee) || toCents(seenFee) !== express.feeCents) return { error: t.errors.expressFee };
  return { method: "MAILBOX", mailboxId, feeCents: express.feeCents };
}
