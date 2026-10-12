import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { fmt, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { PAGE_SIZE, searchCatalog } from "@/lib/data/catalog";
import { getShopReviews } from "@/lib/data/reviews";
import { getFeaturedItems, getRenamedShopSlug, getShopBySlug, isShopSlug, type ShopDetails } from "@/lib/data/shops";
import type { Format } from "@/lib/format";
import { shopMediaUrl } from "@/lib/shop-media";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { Pagination } from "@/components/catalog/pagination";
import { ProductGrid } from "@/components/catalog/product-card";
import { ReviewList } from "@/components/catalog/review-list";
import { ShopHeader, type ShopHeaderStat } from "@/components/catalog/shop-header";
import { BlockSkeleton, ProductGridSkeleton } from "@/components/catalog/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";

type Params = PageProps<"/[lang]/t/[slug]">["params"];
type SearchParams = PageProps<"/[lang]/t/[slug]">["searchParams"];

export async function generateMetadata(props: PageProps<"/[lang]/t/[slug]">): Promise<Metadata> {
  const [{ slug }, m] = await Promise.all([props.params, getMessages()]);
  const shop = isShopSlug(slug) ? await getShopBySlug(slug) : null;
  if (!shop) return { title: m.errors.notFound.title };
  return {
    title: shop.name,
    description: shop.tagline || shop.description || fmt(m.catalog.shop.owner, { name: shop.ownerName }),
  };
}

function shopStats(m: Messages, f: Format, shop: ShopDetails): ShopHeaderStat[] {
  const t = m.catalog.shop.stats;
  return [
    { label: t.listings, value: f.integer(shop.listingCount) },
    { label: t.sold, value: f.integer(shop.unitsSold) },
    {
      label: t.rating,
      value: shop.ratingAvg === null ? m.common.none : fmt(m.catalog.reviews.average, { rating: f.rating(shop.ratingAvg) }),
    },
  ];
}

async function ShopListings({ slug, searchParams }: { slug: string; searchParams: SearchParams }) {
  const m = await getMessages();
  const t = m.catalog.shop;
  const raw = (await searchParams).page;
  const requested = Number.parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
  const page = Number.isFinite(requested) && requested > 1 ? Math.min(requested, 10_000) : 1;
  const { items, total } = await searchCatalog({ shopSlug: slug, sort: "relevance", page });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (items.length === 0) {
    return <EmptyState icon="item_frame" title={t.empty.title} body={t.empty.body} />;
  }
  return (
    <>
      <ProductGrid items={items} />
      <Pagination page={page} totalPages={totalPages} href={(p) => (p > 1 ? `/t/${slug}?page=${p}#showcase` : `/t/${slug}#showcase`)} />
    </>
  );
}

/**
 * The approved shop with this slug. An old slug of a shop (it changed it) redirects for good to
 * the current one, so old links keep working; anything else is a 404.
 */
async function loadShop(slug: string): Promise<ShopDetails> {
  if (!isShopSlug(slug)) notFound();
  const shop = await getShopBySlug(slug);
  if (shop) return shop;
  const current = await getRenamedShopSlug(slug);
  if (current) permanentRedirect(`/t/${current}`);
  notFound();
}

async function ShopPageContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const shop = await loadShop(slug);
  const [reviews, featured] = await Promise.all([
    getShopReviews(shop.id, 10),
    getFeaturedItems(shop.id, shop.featuredListingIds),
  ]);
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.shop;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Breadcrumbs
          items={[
            { label: m.catalog.breadcrumbs.home, href: "/" },
            { label: m.catalog.breadcrumbs.shops, href: "/shops" },
            { label: shop.name },
          ]}
        />
        <ShopHeader
          shop={{
            ...shop,
            logoUrl: shopMediaUrl(shop.logoPath),
            bannerUrl: shopMediaUrl(shop.bannerPath),
          }}
          stats={shopStats(m, f, shop)}
        />
      </div>

      {featured.length > 0 ? (
        <section id="featured" aria-label={t.featuredTitle} className="scroll-mt-4">
          <SectionHeader label={t.featuredLabel} title={t.featuredTitle} />
          <ProductGrid items={featured} layout="featured" />
        </section>
      ) : null}

      <section id="showcase" className="scroll-mt-4">
        <SectionHeader label={t.listingsLabel} title={t.listingsTitle} />
        <Suspense fallback={<ProductGridSkeleton count={10} />}>
          <ShopListings slug={slug} searchParams={searchParams} />
        </Suspense>
      </section>

      <ReviewList page={reviews} title={m.catalog.reviews.shopTitle} showListing />
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <BlockSkeleton className="mb-4 h-4 w-48" />
        <BlockSkeleton className="h-48" />
      </div>
      <ProductGridSkeleton count={10} />
    </div>
  );
}

export default function ShopPage(props: PageProps<"/[lang]/t/[slug]">) {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopPageContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
