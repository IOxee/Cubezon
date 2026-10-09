import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/data/catalog";
import { publicDb } from "@/lib/supabase/server";
import { ratingBucket } from "@/lib/rating";

/**
 * Public reviews (view public.public_reviews: reviews of approved shops with the author's
 * in-game name). Every review comes from a collected order, so all are verified purchases.
 * Tagged "reviews" and "catalog" (a new review also changes the catalog rating).
 */

export const REVIEWS_TAG = "reviews";

export type PublicReview = {
  id: string;
  listingId: string;
  shopId: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  listingTitle: string;
};

export type ReviewSummary = {
  count: number;
  average: number | null;
  /** Reviews per star: index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
};

export type ReviewPage = { reviews: PublicReview[]; summary: ReviewSummary };

type ReviewTarget = { listingId: string } | { shopId: string };

const COLUMNS = "id, listing_id, shop_id, rating, body, created_at, author_name, listing_title";

/** Upper bound of ratings read to build the summary (plenty for a game server). */
const SUMMARY_LIMIT = 5000;

async function loadReviews(target: ReviewTarget, limit: number): Promise<ReviewPage> {
  const column: "listing_id" | "shop_id" = "listingId" in target ? "listing_id" : "shop_id";
  const value = "listingId" in target ? target.listingId : target.shopId;
  const db = publicDb();

  const [latest, ratings] = await Promise.all([
    db
      .from("public_reviews")
      .select(COLUMNS)
      .eq(column, value)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(limit),
    db.from("public_reviews").select("rating").eq(column, value).limit(SUMMARY_LIMIT),
  ]);
  if (latest.error) throw latest.error;
  if (ratings.error) throw ratings.error;

  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const { rating } of ratings.data ?? []) {
    if (rating == null || rating < 0.5 || rating > 5) continue;
    distribution[ratingBucket(Number(rating)) - 1] += 1;
    sum += Number(rating);
  }
  const count = distribution.reduce((a, b) => a + b, 0);

  return {
    reviews: (latest.data ?? []).map((row) => ({
      id: row.id!,
      listingId: row.listing_id!,
      shopId: row.shop_id!,
      rating: row.rating ?? 0,
      body: row.body ?? "",
      createdAt: row.created_at ?? "",
      authorName: row.author_name ?? "",
      listingTitle: row.listing_title ?? "",
    })),
    summary: { count, average: count > 0 ? sum / count : null, distribution },
  };
}

/** Latest reviews of a listing plus the summary of all of them. */
export async function getListingReviews(listingId: string, limit = 10): Promise<ReviewPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(REVIEWS_TAG, CATALOG_TAG, `listing:${listingId}`);
  return loadReviews({ listingId }, limit);
}

/** Latest reviews of any listing of a shop plus the summary of all of them. */
export async function getShopReviews(shopId: string, limit = 10): Promise<ReviewPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(REVIEWS_TAG, CATALOG_TAG, `shop-reviews:${shopId}`);
  return loadReviews({ shopId }, limit);
}
