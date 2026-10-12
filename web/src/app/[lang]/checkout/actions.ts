"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fmt } from "@/i18n";
import { getActionFormat, getActionMessages } from "@/i18n/server";
import { allowSelfPurchase } from "@/lib/dev-flags";
import { requirePlayer } from "@/lib/auth/session";
import {
  CART_COOKIE,
  CART_COOKIE_OPTIONS,
  decimalToCents,
  parseCart,
  parseCheckoutLines,
  priceCheckout,
  removeFromCart,
  serializeCart,
  type PricedLine,
} from "@/lib/cart";
import { isUuid } from "@/lib/data/catalog";
import { getExpressSettings, getMyMailboxes, getShopExpressFees, getTipSettings } from "@/lib/data/delivery";
import { createOrders, getCheckoutListings, isActiveLocker, type CheckoutDelivery } from "@/lib/data/orders";
import { expressFeesByLine, parseDeliveryMethod, shopsSetExpressFee, type ExpressSettings } from "@/lib/delivery";
import { fromCents } from "@/lib/format";
import { parseTipInput, tipFieldName, tipsByLine } from "@/lib/tips";
import { checkoutProblemText } from "@/components/shopping/checkout-problem";

export type PlaceOrderState = { error: string | null; details: string[] };

/**
 * Confirms the checkout: one PENDING order per line. Nothing from the form is trusted except
 * what the buyer asked for (listing, units, locker or mailbox, tips) and the prices they saw
 * (unit prices and the total express fee): the session, the catalog, the stock, the shop owner,
 * the locker, the buyer's mailboxes, the express and tip settings and the shops' express fees are
 * all read again here. Payment happens later in the game, when the plugin processes the order.
 */
export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const [m, f] = await Promise.all([getActionMessages(), getActionFormat()]);
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
          problem: checkoutProblemText(m, f, problem),
        }),
      ),
    };
  }

  const expressFeesCents = await readExpressFees(formData, delivery, result.lines);
  if (expressFeesCents === null) {
    refresh();
    return { error: t.errors.expressFee, details: [] };
  }
  const tips = await readTips(formData, result.lines);
  if ("error" in tips) {
    refresh();
    return { error: tips.error, details: [] };
  }

  try {
    await createOrders(player, delivery.delivery, result.lines, { expressFeesCents, tipsCents: tips.tipsCents });
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

/** The delivery chosen and, for express, the settings in force now. */
type ReadDelivery = { delivery: CheckoutDelivery; express: ExpressSettings | null };

/** Locker or express delivery, checked against the database. */
async function readDelivery(formData: FormData, playerUuid: string): Promise<ReadDelivery | { error: string }> {
  const t = (await getActionMessages()).shopping.checkout;
  if (parseDeliveryMethod(formData.get("delivery")) === "LOCKER") {
    const lockerId = formData.get("locker");
    if (!isUuid(lockerId) || !(await isActiveLocker(lockerId))) return { error: t.errors.locker };
    return { delivery: { method: "LOCKER", lockerId }, express: null };
  }

  const mailboxId = formData.get("mailbox");
  const [express, mailboxes] = await Promise.all([getExpressSettings(), getMyMailboxes(playerUuid)]);
  if (!express.enabled) return { error: t.errors.expressOff };
  if (!isUuid(mailboxId) || !mailboxes.some((mailbox) => mailbox.id === mailboxId)) return { error: t.errors.mailbox };
  return { delivery: { method: "MAILBOX", mailboxId }, express };
}

/**
 * The express fee of each line with the current settings and shop fees (all 0 for a locker), or
 * null when their sum is not the express total the buyer saw (field expressTotal).
 */
async function readExpressFees(formData: FormData, { express }: ReadDelivery, lines: PricedLine[]): Promise<number[] | null> {
  if (!express) return lines.map(() => 0);
  const shopFees = shopsSetExpressFee(express)
    ? await getShopExpressFees([...new Set(lines.map((line) => line.shopId))])
    : new Map<string, number | null>();
  const fees = expressFeesByLine(lines, express, shopFees);
  const seen = decimalToCents(formData.get("expressTotal"));
  return seen === fees.reduce((sum, fee) => sum + fee, 0) ? fees : null;
}

/** The tip of each line from the one typed for each shop (field tip-<shopId>), or the error to show. */
async function readTips(formData: FormData, lines: PricedLine[]): Promise<{ tipsCents: number[] } | { error: string }> {
  const [m, f] = await Promise.all([getActionMessages(), getActionFormat()]);
  const t = m.shopping.checkout;
  const settings = await getTipSettings();
  const byShop = new Map<string, number>();
  for (const shopId of new Set(lines.map((line) => line.shopId))) {
    const tip = parseTipInput(formData.get(tipFieldName(shopId)), settings);
    if (!tip.ok) {
      return tip.error === "off"
        ? { error: t.errors.tipsOff }
        : { error: fmt(t.errors.tip, { max: f.money(fromCents(settings.maxCents)) }) };
    }
    byShop.set(shopId, tip.cents);
  }
  return { tipsCents: tipsByLine(lines, byShop) };
}
