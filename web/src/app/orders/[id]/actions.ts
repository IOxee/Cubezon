"use server";

import { updateTag } from "next/cache";
import { m } from "@/i18n";
import { requirePlayer } from "@/lib/auth/session";
import { CATALOG_TAG, isUuid } from "@/lib/data/catalog";
import { saveReview } from "@/lib/data/orders";
import { REVIEWS_TAG } from "@/lib/data/reviews";
import { SHOPS_TAG } from "@/lib/data/shops";
import { parseRating } from "@/lib/rating";

export type ReviewState = { status: "idle" | "saved" | "error"; message: string | null };

// Same limit as the CHECK on reviews.body.
const REVIEW_MAX_LENGTH = 1000;

/** Creates or updates the review of a collected order of the logged-in player. */
export async function saveReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = m.account.order.review.errors;
  const orderId = formData.get("orderId");
  if (!isUuid(orderId)) return { status: "error", message: t.notAllowed };
  const player = await requirePlayer(`/pedidos/${orderId}`);

  const rating = parseRating(formData.get("rating"));
  if (rating === null) return { status: "error", message: t.rating };

  const rawBody = formData.get("body");
  const body = typeof rawBody === "string" ? rawBody.trim().replace(/\r\n/g, "\n") : "";
  // char_length in Postgres counts code points, like the spread.
  if ([...body].length > REVIEW_MAX_LENGTH) return { status: "error", message: t.body };

  try {
    const result = await saveReview(player, orderId.toLowerCase(), rating, body);
    if (!result.ok) return { status: "error", message: t.notAllowed };
  } catch (error) {
    console.error("saveReview failed", error);
    return { status: "error", message: t.failed };
  }

  // Ratings show up in the catalog, the shop directory and the review lists.
  updateTag(REVIEWS_TAG);
  updateTag(CATALOG_TAG);
  updateTag(SHOPS_TAG);
  return { status: "saved", message: null };
}
