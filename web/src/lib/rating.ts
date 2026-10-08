/**
 * Review ratings: 0.5 to 5 in steps of 0.5 (same rule as the CHECK on reviews.rating).
 * Pure module, shared by the review form, its Server Action and the rating display.
 */

export const MAX_RATING = 5;

/** Every valid rating: 0.5, 1, 1.5 … 5. */
export const RATING_STEPS: readonly number[] = Array.from({ length: MAX_RATING * 2 }, (_, i) => (i + 1) / 2);

/** A rating from a form field, or null when it is not one of RATING_STEPS. */
export function parseRating(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d(\.[05])?$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return RATING_STEPS.includes(value) ? value : null;
}

/** Nearest half star (for averages like 4.27 -> 4.5), clamped to 0..5. */
export function roundToHalf(value: number): number {
  return Math.min(MAX_RATING, Math.max(0, Math.round(value * 2) / 2));
}

export type StarFill = "full" | "half" | "empty";

/** How much of the n-th square (1..5) a rating fills. */
export function starFill(value: number, n: number): StarFill {
  const rounded = roundToHalf(value);
  if (rounded >= n) return "full";
  if (rounded >= n - 0.5) return "half";
  return "empty";
}

/** Histogram bucket (1..5 stars) of a rating: half stars go up (3.5 counts as 4). */
export function ratingBucket(value: number): number {
  return Math.min(MAX_RATING, Math.max(1, Math.ceil(value)));
}
