import Link from "next/link";
import { fmt, m } from "@/i18n";

/** Pages to show: first, last and the current one with its neighbours; null = gap. */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const p of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && p - previous > 1) result.push(null);
    result.push(p);
  }
  return result;
}

/** Numbered pagination with links (works without JavaScript). */
export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={m.a11y.pagination} className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-sm" rel="prev">
          {m.catalog.pagination.previous}
        </Link>
      ) : null}
      {pageWindow(page, totalPages).map((p, index) =>
        p === null ? (
          <span key={`gap-${index}`} aria-hidden className="px-1 font-mono text-ink-3">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            aria-label={fmt(m.catalog.pagination.current, { page: p })}
            className="btn btn-sm btn-ink num"
          >
            {p}
          </span>
        ) : (
          <Link key={p} href={href(p)} aria-label={fmt(m.catalog.pagination.page, { page: p })} className="btn btn-sm num">
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={href(page + 1)} className="btn btn-sm" rel="next">
          {m.catalog.pagination.next}
        </Link>
      ) : null}
    </nav>
  );
}
