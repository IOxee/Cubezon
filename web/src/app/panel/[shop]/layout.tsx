import Link from "next/link";
import { Suspense } from "react";
import { m } from "@/i18n";
import { ShopSidebar, ShopSidebarSkeleton } from "./_components/shop-sidebar";

/**
 * Panel of one shop (/panel/<slug>): side menu and the page. The layout stays static; the menu
 * and every page await the slug and the session behind their own <Suspense>, and every page
 * loads the shop by slug and owner itself (requireSellerShop), so nobody reaches someone else's.
 */
export default function ShopPanelLayout({ children, params }: LayoutProps<"/panel/[shop]">) {
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Link href="/panel" className="link mb-3 inline-flex items-center gap-1 text-sm font-semibold">
          <span aria-hidden>←</span>
          {m.seller.panel.myShops}
        </Link>
        <Suspense fallback={<ShopSidebarSkeleton />}>
          <ShopSidebar params={params} />
        </Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
