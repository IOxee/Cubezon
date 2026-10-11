import Link from "next/link";
import type { ReactNode } from "react";
import { m } from "@/i18n";
import { getCurrentPlayer } from "@/lib/auth/session";
import { getPanelAccess } from "@/lib/data/seller";
import type { ShopPermission } from "@/lib/seller/permissions";
import { panelPath } from "@/lib/seller/shops";

/** Title block of every panel page (static, so it is part of the prerendered shell). */
export function PanelHeader({
  title,
  label = m.seller.panel.label,
  action,
}: {
  title: string;
  label?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-edge pb-3">
      <div>
        <p className="label">{label}</p>
        <h1 className="text-2xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

/**
 * Link to a section of the shop in the URL (/panel/<slug>/...). It awaits the route params, so
 * render it inside <Suspense> (ShopPanelLinkFallback keeps the same size meanwhile). With
 * `permission`, nothing is shown to a player whose rank in the shop lacks it.
 */
export async function ShopPanelLink({
  params,
  segments = [],
  permission,
  className,
  children,
}: {
  params: Promise<{ shop: string }>;
  segments?: string[];
  permission?: ShopPermission;
  className?: string;
  children: ReactNode;
}) {
  const { shop: shopSlug } = await params;
  if (permission) {
    const player = await getCurrentPlayer();
    const access = player ? await getPanelAccess(player.uuid, shopSlug) : null;
    if (!access?.permissions.includes(permission)) return null;
  }
  return (
    <Link href={panelPath(shopSlug, ...segments)} className={className}>
      {children}
    </Link>
  );
}

export function ShopPanelLinkFallback({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span aria-hidden className={`${className ?? ""} pointer-events-none opacity-60`}>
      {children}
    </span>
  );
}

/** Big figure with a mono label (KPIs of the overview). */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card flex flex-col p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-2xl leading-tight">{value}</p>
      {hint ? <p className="mt-auto pt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">{m.a11y.loading}</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-24" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="skeleton h-12" />
      ))}
    </div>
  );
}
