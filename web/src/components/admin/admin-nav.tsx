"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type AdminNavItem = { href: string; label: string; segment: string | null };

/** Admin sections: a column on wide screens, a scrollable row on phones. */
export function AdminNav({ items, label }: { items: AdminNavItem[]; label: string }) {
  const segment = useSelectedLayoutSegment();
  return (
    <nav aria-label={label}>
      <ul className="scroll-row flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = item.segment === segment;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`btn btn-sm lg:flex lg:w-full lg:justify-start ${active ? "btn-ink" : "btn-ghost"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
