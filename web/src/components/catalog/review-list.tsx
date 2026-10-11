import Link from "next/link";
import { fmt, m, plural } from "@/i18n";
import type { ReviewPage } from "@/lib/data/reviews";
import { formatDate, formatRating } from "@/lib/format";
import { Rating } from "@/components/ui/rating";
import { SectionHeader } from "@/components/ui/section-header";
import { RichText } from "./rich-text";

/** Average, count and one bar per star (5 to 1). */
function ReviewSummaryPanel({ summary }: { summary: ReviewPage["summary"] }) {
  const t = m.catalog.reviews;
  return (
    <div className="card-soft flex flex-col gap-3 p-4">
      <div className="flex items-baseline gap-2">
        <span className="num text-3xl font-semibold">{summary.average === null ? m.common.none : formatRating(summary.average)}</span>
        <span className="text-sm text-ink-3">/ 5</span>
      </div>
      <Rating value={summary.average} count={summary.count} />
      <ul className="flex flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary.distribution[stars - 1];
          const percent = summary.count > 0 ? Math.round((count / summary.count) * 100) : 0;
          const starsLabel = plural(stars, t.stars);
          return (
            <li
              key={stars}
              className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-2 text-xs"
              aria-label={fmt(t.starsShare, { stars: starsLabel, percent })}
            >
              <span aria-hidden className="num text-ink-2">
                {stars}
              </span>
              <span aria-hidden className="h-2.5 border border-edge bg-paper">
                <span className="block h-full bg-ink" style={{ width: `${percent}%` }} />
              </span>
              <span aria-hidden className="num text-right text-ink-3">
                {percent} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Reviews block of a listing or a shop: summary on the left, latest reviews on the right.
 * With showListing, each review links to the listing it is about (shop page).
 */
export function ReviewList({
  page,
  title,
  showListing = false,
  id = "reviews",
}: {
  page: ReviewPage;
  title: string;
  showListing?: boolean;
  id?: string;
}) {
  const t = m.catalog.reviews;
  const { reviews, summary } = page;
  return (
    <section id={id} aria-label={title} className="scroll-mt-4">
      <SectionHeader label={t.label} title={title} />
      {summary.count === 0 ? (
        <p className="card-soft px-4 py-6 text-sm text-ink-2">{t.empty}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
          <ReviewSummaryPanel summary={summary} />
          <div>
            <ol className="flex flex-col gap-3">
              {reviews.map((review) => (
                <li key={review.id} className="card-soft p-4">
                  <article className="flex flex-col gap-1.5">
                    <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-semibold">{review.authorName}</span>
                      <Rating value={review.rating} count={1} showCount={false} />
                      <span className="badge badge-paper">{t.verified}</span>
                      <time dateTime={review.createdAt} className="ml-auto text-xs text-ink-3">
                        {formatDate(review.createdAt)}
                      </time>
                    </header>
                    {showListing ? (
                      <p className="text-xs text-ink-3">
                        <RichText
                          template={t.about}
                          values={{
                            listing: (
                              <Link href={`/p/${review.listingId}`} className="link">
                                {review.listingTitle}
                              </Link>
                            ),
                          }}
                        />
                      </p>
                    ) : null}
                    <p className={`whitespace-pre-line ${review.body ? "" : "text-sm text-ink-3"}`}>
                      {review.body || t.noBody}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
            {summary.count > reviews.length ? (
              <p className="mt-3 text-xs text-ink-3">{fmt(t.showingLatest, { count: reviews.length })}</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
