import Link from "next/link";
import { fmt, m } from "@/i18n";

/** Previous / next links that keep the current filters (query params). */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string>;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ""));
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label={m.admin.pagination.label} className="mt-4 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn btn-sm" rel="prev">
          {m.admin.pagination.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="num text-ink-2">{fmt(m.admin.pagination.page, { page, pages: pageCount })}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="btn btn-sm" rel="next">
          {m.admin.pagination.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** ?page= as a positive integer (1 by default). */
export function parsePage(value: string | string[] | undefined): number {
  const page = Number.parseInt(firstParam(value), 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1;
}
