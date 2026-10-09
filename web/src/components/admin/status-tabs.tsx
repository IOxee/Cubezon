import Link from "next/link";
import { formatInteger } from "@/lib/format";

export type StatusTab = { href: string; label: string; count?: number; active: boolean };

/** Folder tabs that filter a list (links, so the filter lives in the URL). */
export function StatusTabs({ label, tabs }: { label: string; tabs: StatusTab[] }) {
  return (
    <nav aria-label={label} className="mb-4 border-b-2 border-edge">
      <ul className="scroll-row -mb-0.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`flex items-center gap-2 border-2 px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                tab.active
                  ? "border-edge border-b-surface bg-surface"
                  : "border-transparent text-ink-2 hover:border-line hover:border-b-edge"
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className={`badge num ${tab.active ? "badge-ink" : "badge-paper"}`}>{formatInteger(tab.count)}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
