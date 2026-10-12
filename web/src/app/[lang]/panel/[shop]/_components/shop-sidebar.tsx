import Link from "next/link";
import { Suspense } from "react";
import { getMessages } from "@/i18n/server";
import { getCurrentPlayer } from "@/lib/auth/session";
import { getPanelShops } from "@/lib/data/seller";
import { inkStyle } from "@/lib/inks";
import { panelPath } from "@/lib/seller/shops";
import { ShopSeal } from "@/components/ui/shop-mark";
import { PanelNav, PanelNavLinks } from "./panel-nav";

/**
 * Side menu of one shop's panel: its seal and status, its sections (fewer for employees) and a
 * switch to the player's other shops, owned or where they work. Awaits params and the session, so
 * it renders inside <Suspense>. Nothing is shown for a slug that is not one of the player's
 * shops: the page itself answers with a 404.
 */
export async function ShopSidebar({ params }: { params: Promise<{ shop: string }> }) {
  const [{ shop: shopSlug }, player, m] = await Promise.all([params, getCurrentPlayer(), getMessages()]);
  if (!player) return null;
  const shops = await getPanelShops(player.uuid);
  const shop = shops.find((candidate) => candidate.slug === shopSlug);
  if (!shop) return null;
  const others = shops.filter((candidate) => candidate.id !== shop.id);

  return (
    <>
      <div className="card-soft mb-3 flex items-center gap-3 p-3" style={inkStyle(shop.ink)}>
        <ShopSeal name={shop.name} ink={shop.ink} size={40} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-shop">{shop.name}</p>
          <p className="text-xs text-ink-3">
            {m.status.shop[shop.status]}
            {shop.role === "employee" ? ` · ${shop.roleName ?? m.panelRole.employee}` : null}
          </p>
        </div>
      </div>

      <Suspense fallback={<PanelNavLinks slug={shop.slug} pathname={null} role={shop.role} />}>
        <PanelNav slug={shop.slug} role={shop.role} />
      </Suspense>

      {others.length > 0 ? (
        <details className="card-soft mt-3">
          <summary className="label cursor-pointer px-3 py-2">{m.seller.panel.switchShop}</summary>
          <ul className="border-t border-line py-1">
            {others.map((other) => (
              <li key={other.id} style={inkStyle(other.ink)}>
                <Link href={panelPath(other.slug)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface">
                  <ShopSeal name={other.name} ink={other.ink} size={24} />
                  <span className="min-w-0 truncate font-semibold text-shop">{other.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

export async function ShopSidebarSkeleton() {
  const m = await getMessages();
  return (
    <div className="space-y-2" aria-busy="true">
      <span className="sr-only">{m.a11y.loading}</span>
      <div className="skeleton h-16" />
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="skeleton h-9" />
      ))}
    </div>
  );
}
