import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination, firstParam, parsePage } from "@/components/admin/pagination";
import { TableSkeleton } from "@/components/admin/skeletons";
import { StatusTabs } from "@/components/admin/status-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getFormat, getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import {
  ADMIN_PAGE_SIZE,
  SHOP_STATUSES,
  countShopsByStatus,
  listShops,
  type ShopStatus,
} from "@/lib/data/admin";
import { ShopReviewCard } from "./_components/shop-review-card";
import { keyFromSlug, keySlug } from "@/lib/url-slug";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.admin.shops.title };
}

function statusFromSlug(slug: string): ShopStatus {
  return keyFromSlug(SHOP_STATUSES, slug) ?? "PENDING";
}

export default async function AdminShopsPage(props: PageProps<"/[lang]/admin/shops">) {
  const t = (await getMessages()).admin.shops;
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <ShopsList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ShopsList({ searchParams }: { searchParams: PageProps<"/[lang]/admin/shops">["searchParams"] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const status = statusFromSlug(firstParam(params.status));
  const page = parsePage(params.page);

  const [counts, { shops, total }, m, f] = await Promise.all([
    countShopsByStatus(),
    listShops(status, page),
    getMessages(),
    getFormat(),
  ]);
  const t = m.admin.shops;

  return (
    <>
      <StatusTabs
        label={t.tabsLabel}
        tabs={SHOP_STATUSES.map((tab) => ({
          href: tab === "PENDING" ? "/admin/shops" : `/admin/shops?status=${keySlug(tab)}`,
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
              <ShopReviewCard shop={shop} canSetOfficial={staff.role === "SUPERADMIN"} m={m} f={f} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={Math.ceil(total / ADMIN_PAGE_SIZE)}
        basePath="/admin/shops"
        params={{ status: status === "PENDING" ? "" : keySlug(status) }}
      />
    </>
  );
}
