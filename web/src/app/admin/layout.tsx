import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminShellSkeleton } from "@/components/admin/skeletons";
import { fmt, m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: m.admin.meta.title, template: m.admin.meta.titleTemplate },
  robots: { index: false, follow: false },
};

/**
 * Admin area. The whole frame waits for the staff check (404 for anyone else), so the static
 * shell only holds a neutral skeleton. Each page checks again and loads its data in its own
 * Suspense boundary, so navigating between sections stays instant. Every admin page refreshes
 * itself every few seconds (AutoRefresh), so moderation queues stay current.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const items: AdminNavItem[] = [
    { href: "/admin", label: m.admin.nav.overview, segment: null },
    { href: "/admin/shops", label: m.admin.nav.shops, segment: "shops" },
    { href: "/admin/orders", label: m.admin.nav.orders, segment: "orders" },
    { href: "/admin/lockers", label: m.admin.nav.lockers, segment: "lockers" },
    { href: "/admin/photos", label: m.admin.nav.photos, segment: "photos" },
  ];
  if (staff.role === "SUPERADMIN") {
    items.push({ href: "/admin/team", label: m.admin.nav.team, segment: "team" });
    items.push({ href: "/admin/players", label: m.admin.nav.players, segment: "players" });
    items.push({ href: "/admin/themes", label: m.admin.nav.themes, segment: "themes" });
    items.push({ href: "/admin/features", label: m.admin.nav.features, segment: "features" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-3 lg:sticky lg:top-4 lg:self-start">
        <div className="card-soft px-3 py-2">
          <p className="label">{m.admin.label}</p>
          <p className="mt-1 truncate text-sm">{fmt(m.admin.session, { name: staff.name })}</p>
          <span className="badge badge-ink mt-1">{m.status.staff[staff.role ?? "ADMIN"]}</span>
        </div>
        <AdminNav items={items} label={m.admin.nav.label} />
      </aside>
      <div className="min-w-0">{children}</div>
      <AutoRefresh />
    </div>
  );
}
