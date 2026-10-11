"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "@/i18n";
// Type only: the data module is server-only.
import type { PanelRole } from "@/lib/data/seller";
import { panelPath } from "@/lib/seller/shops";

/** Sections of the panel; `ownerOnly` ones are hidden from employees (and 404 for them). */
const SECTIONS = [
  { segment: "", label: m.seller.panel.nav.overview, ownerOnly: false },
  { segment: "products", label: m.seller.panel.nav.listings, ownerOnly: false },
  { segment: "orders", label: m.seller.panel.nav.orders, ownerOnly: false },
  { segment: "staff", label: m.roleplay.panel.nav, ownerOnly: false },
  { segment: "ranks", label: m.roles.nav, ownerOnly: true },
  { segment: "shop", label: m.seller.panel.nav.shop, ownerOnly: true },
] as const;

function isActive(pathname: string | null, href: string, exact: boolean): boolean {
  if (!pathname) return false;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sections of one shop's panel for the player's role in it. Without a pathname (prerender) no
 * link is marked as current.
 */
export function PanelNavLinks({
  slug,
  pathname,
  role = "owner",
}: {
  slug: string;
  pathname: string | null;
  role?: PanelRole;
}) {
  return (
    <nav aria-label={m.seller.panel.nav.label}>
      <ul className="scroll-row flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.filter((section) => role === "owner" || !section.ownerOnly).map((section) => {
          const href = panelPath(slug, section.segment);
          const active = isActive(pathname, href, section.segment === "");
          return (
            <li key={section.segment}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`btn btn-ghost w-full justify-start whitespace-nowrap ${
                  active
                    ? "bg-surface font-semibold shadow-[inset_0_-3px_0_var(--edge)] lg:shadow-[inset_3px_0_0_var(--edge)]"
                    : "text-ink-2"
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reads the pathname: suspends on dynamic routes, so render it inside <Suspense>. */
export function PanelNav({ slug, role = "owner" }: { slug: string; role?: PanelRole }) {
  return <PanelNavLinks slug={slug} pathname={usePathname()} role={role} />;
}
