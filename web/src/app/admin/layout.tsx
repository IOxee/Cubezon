import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
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
 * Suspense boundary, so navigating between sections stays instant.
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
    { href: "/admin/tiendas", label: m.admin.nav.shops, segment: "tiendas" },
    { href: "/admin/pedidos", label: m.admin.nav.orders, segment: "pedidos" },
    { href: "/admin/taquillas", label: m.admin.nav.lockers, segment: "taquillas" },
    { href: "/admin/fotos", label: m.admin.nav.photos, segment: "fotos" },
  ];
  if (staff.role === "SUPERADMIN") {
    items.push({ href: "/admin/equipo", label: m.admin.nav.team, segment: "equipo" });
    items.push({ href: "/admin/jugadores", label: m.admin.nav.players, segment: "jugadores" });
    items.push({ href: "/admin/temas", label: m.admin.nav.themes, segment: "temas" });
    items.push({ href: "/admin/funciones", label: m.admin.nav.features, segment: "funciones" });
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
    </div>
  );
}
