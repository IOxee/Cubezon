import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination, firstParam, parsePage } from "@/components/admin/pagination";
import { TableSkeleton } from "@/components/admin/skeletons";
import { StatusTabs } from "@/components/admin/status-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import {
  ADMIN_PAGE_SIZE,
  SHOP_STATUSES,
  countShopsByStatus,
  listShops,
  type ShopStatus,
} from "@/lib/data/admin";
import { ShopReviewCard } from "./_components/shop-review-card";

export const metadata: Metadata = { title: m.admin.shops.title };

const t = m.admin.shops;

function statusFromSlug(slug: string): ShopStatus {
  return SHOP_STATUSES.find((status) => m.admin.slugs.shop[status] === slug) ?? "PENDING";
}

export default function AdminShopsPage(props: PageProps<"/admin/tiendas">) {
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <ShopsList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ShopsList({ searchParams }: { searchParams: PageProps<"/admin/tiendas">["searchParams"] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const status = statusFromSlug(firstParam(params.estado));
  const page = parsePage(params.pagina);

  const [counts, { shops, total }] = await Promise.all([countShopsByStatus(), listShops(status, page)]);

  return (
    <>
      <StatusTabs
        label={t.tabsLabel}
        tabs={SHOP_STATUSES.map((tab) => ({
          href: tab === "PENDING" ? "/admin/tiendas" : `/admin/tiendas?estado=${m.admin.slugs.shop[tab]}`,
          label: t.tabs[tab],
          count: counts[tab],
          active: tab === status,
        }))}
      />

      {shops.length === 0 ? (
        <EmptyState icon="writable_book" title={t.empty[status].title} body={t.empty[status].body} />
      ) : (
        <ul className="grid gap-3">
          {shops.map((shop) => (
            <li key={shop.id}>
              <ShopReviewCard shop={shop} canSetOfficial={staff.role === "SUPERADMIN"} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={Math.ceil(total / ADMIN_PAGE_SIZE)}
        basePath="/admin/tiendas"
        params={{ estado: status === "PENDING" ? "" : m.admin.slugs.shop[status] }}
      />
    </>
  );
}
