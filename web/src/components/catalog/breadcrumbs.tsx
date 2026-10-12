import Link from "next/link";
import { getMessages } from "@/i18n/server";

export type Crumb = { label: string; href?: string };

/** "Catálogo › Herramientas › Pico de diamante": the last crumb is the current page. */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const m = await getMessages();
  return (
    <nav aria-label={m.a11y.breadcrumbs} className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="link">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="max-w-[28ch] truncate text-ink-3">
                  {item.label}
                </span>
              )}
              {last ? null : (
                <span aria-hidden className="font-mono text-ink-3">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
