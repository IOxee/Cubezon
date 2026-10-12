"use client";

import { fmt, plural } from "@/i18n";
import { useFormat, useMessages } from "@/i18n/client";
import { starFill, type StarFill } from "@/lib/rating";

/** One pixel square of a rating: full, half (left half filled) or empty. */
export function RatingSquare({ fill, className = "size-2.5" }: { fill: StarFill; className?: string }) {
  return (
    <span className={`relative inline-block border border-edge ${className}`}>
      {fill === "empty" ? null : (
        <span className={`absolute inset-y-0 left-0 bg-accent ${fill === "full" ? "right-0" : "w-1/2"}`} />
      )}
    </span>
  );
}

/** Five pixel squares filled to the rating (half squares included), plus the count. */
export function Rating({ value, count, showCount = true }: { value: number | null; count: number; showCount?: boolean }) {
  const m = useMessages();
  const f = useFormat();
  if (value === null || count === 0) {
    return <span className="text-xs text-ink-3">{m.product.noRatings}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span role="img" aria-label={fmt(m.a11y.rating, { rating: f.rating(value) })} className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <RatingSquare key={n} fill={starFill(value, n)} />
        ))}
      </span>
      <span className="num">{f.rating(value)}</span>
      {showCount ? <span>({plural(count, m.product.ratingCount)})</span> : null}
    </span>
  );
}
