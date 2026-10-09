"use client";

import { useActionState, useState } from "react";
import { fmt, m } from "@/i18n";
import { Notice } from "@/components/ui/notice";
import { RatingSquare } from "@/components/ui/rating";
import { formatRating } from "@/lib/format";
import { starFill } from "@/lib/rating";
import { saveReviewAction, type ReviewState } from "../actions";

const INITIAL: ReviewState = { status: "idle", message: null };
// Same limit as the CHECK on reviews.body.
const MAX_LENGTH = 1000;

/** Rating (five pixel squares, half squares allowed) and an optional comment for a collected order. */
export function ReviewForm({
  orderId,
  existing,
}: {
  orderId: string;
  existing: { rating: number; body: string } | null;
}) {
  const t = m.account.order.review;
  const [state, formAction, pending] = useActionState(saveReviewAction, INITIAL);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  // While the pointer is over the squares, show the rating it would pick.
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating;
  const [body, setBody] = useState(existing?.body ?? "");
  const length = [...body].length;
  const saved = state.status === "saved" || existing !== null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />

      <fieldset>
        <legend className="label mb-2">{t.rating}</legend>
        {/* Each square is two radios: its left half (n - 0.5) and the whole square (n). */}
        <div className="flex gap-1.5" onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="relative block size-8">
              <RatingSquare fill={starFill(shown, n)} className="size-8 border-2" />
              {[n - 0.5, n].map((value) => (
                <label
                  key={value}
                  className={`absolute inset-y-0 cursor-pointer ${value === n ? "right-0 left-1/2" : "right-1/2 left-0"}`}
                  onMouseEnter={() => setHover(value)}
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    required
                    className="peer sr-only"
                  />
                  <span className="sr-only">{fmt(t.ratingOption, { n: formatRating(value) })}</span>
                  <span
                    aria-hidden
                    className="block size-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                  />
                </label>
              ))}
            </span>
          ))}
          <span className="num ml-2 self-center text-sm text-ink-2" aria-hidden>
            {shown > 0 ? formatRating(shown) : ""}
          </span>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`review-body-${orderId}`} className="label">
          {t.body}
        </label>
        <textarea
          id={`review-body-${orderId}`}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_LENGTH}
          rows={4}
          aria-describedby={`review-hint-${orderId}`}
          className="input"
        />
        <p id={`review-hint-${orderId}`} className="flex justify-between gap-3 text-xs text-ink-3">
          <span>{t.bodyHint}</span>
          <span className={`num ${length > MAX_LENGTH ? "text-danger" : ""}`}>{fmt(t.counter, { count: length })}</span>
        </p>
      </div>

      {state.status === "saved" ? <Notice tone="success">{t.saved}</Notice> : null}
      {state.status === "error" && state.message ? <Notice tone="danger">{state.message}</Notice> : null}

      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={pending || rating === 0}
        aria-disabled={pending || rating === 0}
      >
        {pending ? t.saving : saved ? t.update : t.submit}
      </button>
    </form>
  );
}
