import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { fmt, plural, type Locale, type Messages } from "@/i18n";
import { itemName } from "@/i18n/items";
import { getFormat, getLocale, getMessages } from "@/i18n/server";
import { getActiveLockers, getCatalogItem, getMoreFromShop, isUuid, type CatalogItem } from "@/lib/data/catalog";
import { getListingReviews } from "@/lib/data/reviews";
import { serialOf, type Format } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { ProductGrid } from "@/components/catalog/product-card";
import { ReviewList } from "@/components/catalog/review-list";
import { BlockSkeleton } from "@/components/catalog/skeletons";
import { BuyBox } from "@/components/shopping/buy-box";
import { ItemIcon } from "@/components/ui/item-icon";
import { ListingVisual } from "@/components/catalog/listing-visual";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { SectionHeader } from "@/components/ui/section-header";
import { SoldBy } from "@/components/ui/shop-mark";
import { Stamp } from "@/components/ui/stamp";
import { keySlug } from "@/lib/url-slug";

export async function generateMetadata(props: PageProps<"/[lang]/p/[id]">): Promise<Metadata> {
  const [{ id }, m, locale] = await Promise.all([props.params, getMessages(), getLocale()]);
  const item = isUuid(id) ? await getCatalogItem(id) : null;
  if (!item) return { title: m.errors.notFound.title };
  return {
    title: item.title,
    description: item.description || `${itemName(item.material, locale)} · ${m.product.soldBy} ${item.shop.name}`,
  };
}

type Ctx = { m: Messages; f: Format; locale: Locale };

function ProductGallery({ m, locale, item }: Omit<Ctx, "f"> & { item: CatalogItem }) {
  const soldOut = item.unitsAvailable === 0;
  return (
    <div className="card relative" style={inkStyle(item.shop.ink)}>
      <div className="squares relative flex aspect-square items-center justify-center" aria-label={m.catalog.product.gallery}>
        <ListingVisual item={item} iconSize={160} iconAlt={fmt(m.a11y.itemIcon, { name: itemName(item.material, locale) })} />
        <span className="num absolute top-2 right-3 text-xs text-ink-3">{fmt(m.common.serial, { serial: serialOf(item.id) })}</span>
        {item.unitAmount > 1 ? (
          <span className="badge badge-paper absolute bottom-2 left-3 text-sm">
            {fmt(m.product.unitShort, { count: item.unitAmount })}
          </span>
        ) : null}
        {soldOut ? (
          <Stamp tone="danger" size="lg" rotate={-8} className="absolute">
            {m.common.soldOutStamp}
          </Stamp>
        ) : null}
        {item.shop.official ? (
          <Stamp tone="shop" size="sm" rotate={5} className="absolute top-3 left-3">
            {m.common.officialStamp}
          </Stamp>
        ) : null}
      </div>
    </div>
  );
}

function ProductInfo({ m, f, locale, item }: Ctx & { item: CatalogItem }) {
  const t = m.catalog.product;
  const soldOut = item.unitsAvailable === 0;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="label">{m.categories[item.category].name}</p>
      <h1 className="text-2xl md:text-3xl">{item.title}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <SoldBy name={item.shop.name} slug={item.shop.slug} ink={item.shop.ink} official={item.shop.official} />
        <a href="#reviews" className="hover:underline" aria-label={t.seeReviews}>
          <Rating value={item.ratingAvg} count={item.ratingCount} />
        </a>
      </div>

      <div className="perforation my-1" />

      <div>
        <p className="label">{t.priceLabel}</p>
        <Price amount={item.unitPrice} size="xl" />
        <p className="mt-1 text-sm text-ink-2">
          {plural(item.unitAmount, m.product.unit)}
          {item.unitAmount > 1 ? (
            <>
              {" · "}
              <span className="num">{fmt(m.product.pricePerItem, { price: f.money(item.pricePerItem) })}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Available units are not shown to the public: only whether it is sold out. */}
      {soldOut || item.unitsSold > 0 ? (
        <p className="text-sm">
          {soldOut ? <span className="font-semibold text-danger">{m.common.soldOutStamp}</span> : null}
          {soldOut && item.unitsSold > 0 ? " · " : null}
          {item.unitsSold > 0 ? (
            <span className="text-ink-3">{plural(item.unitsSold, m.product.sold, { count: f.integer(item.unitsSold) })}</span>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border border-line bg-paper p-2">
        <span className="squares flex shrink-0 items-center justify-center border border-line p-1">
          <ItemIcon material={item.material} size={32} />
        </span>
        <div className="min-w-0">
          <p className="label">{t.itemLabel}</p>
          <p className="font-semibold">{itemName(item.material, locale)}</p>
        </div>
      </div>

      <div>
        <h2 className="label mb-1">{t.descriptionTitle}</h2>
        <p className={`whitespace-pre-line ${item.description ? "" : "text-ink-3"}`}>{item.description || t.noDescription}</p>
      </div>
    </div>
  );
}

function ProductDetailsTable({ m, f, locale, item }: Ctx & { item: CatalogItem }) {
  const t = m.catalog.product.details;
  const category = m.categories[item.category];
  const rows: { label: string; value: ReactNode }[] = [
    { label: t.item, value: itemName(item.material, locale) },
    { label: t.material, value: <code className="font-mono text-sm">{item.material}</code> },
    { label: t.unit, value: plural(item.unitAmount, m.product.unit) },
    {
      label: t.category,
      value: (
        <Link href={`/search?category=${keySlug(item.category)}`} className="link">
          {category.name}
        </Link>
      ),
    },
    {
      label: t.shop,
      value: (
        <Link href={`/t/${item.shop.slug}`} className="link">
          {item.shop.name}
        </Link>
      ),
    },
    { label: t.listing, value: <span className="num">{serialOf(item.id)}</span> },
    { label: t.published, value: <time dateTime={item.createdAt}>{f.date(item.createdAt)}</time> },
    { label: t.sold, value: <span className="num">{f.integer(item.unitsSold)}</span> },
  ];
  return (
    <section>
      <SectionHeader title={t.title} />
      <table className="w-full max-w-2xl border-2 border-edge bg-surface text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="label w-48 bg-paper px-3 py-2 text-left align-top">
                {row.label}
              </th>
              <td className="px-3 py-2">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BuyBoxSkeleton({ m }: { m: Messages }) {
  return (
    <div role="status" aria-label={m.catalog.product.buyBoxLoading} className="card flex flex-col gap-3 p-4">
      <BlockSkeleton className="h-8 w-2/3" />
      <BlockSkeleton className="h-10" />
      <BlockSkeleton className="h-12" />
      <BlockSkeleton className="h-12" />
    </div>
  );
}

async function ProductPageContent({ params }: { params: PageProps<"/[lang]/p/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const item = await getCatalogItem(id);
  if (!item) notFound();

  const [lockers, moreFromShop, reviews] = await Promise.all([
    getActiveLockers(),
    getMoreFromShop(item.shop.slug, item.id, 5),
    getListingReviews(item.id, 10),
  ]);
  const [m, f, locale] = await Promise.all([getMessages(), getFormat(), getLocale()]);
  const category = m.categories[item.category];
  const more = m.catalog.product.moreFromShop;

  return (
    <div className="flex flex-col gap-12">
      <div>
        <Breadcrumbs
          items={[
            { label: m.catalog.breadcrumbs.catalog, href: "/search" },
            { label: category.name, href: `/search?category=${keySlug(item.category)}` },
            { label: item.title },
          ]}
        />
        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3.5fr)]">
          <ProductGallery m={m} locale={locale} item={item} />
          <ProductInfo m={m} f={f} locale={locale} item={item} />
          <div className="md:col-span-2 lg:col-span-1">
            <Suspense fallback={<BuyBoxSkeleton m={m} />}>
              <BuyBox item={item} lockers={lockers} />
            </Suspense>
          </div>
        </div>
      </div>

      <ProductDetailsTable m={m} f={f} locale={locale} item={item} />

      {moreFromShop.length > 0 ? (
        <section>
          <SectionHeader
            label={more.label}
            title={fmt(more.title, { shop: item.shop.name })}
            href={`/t/${item.shop.slug}`}
            linkText={more.link}
          />
          <ProductGrid items={moreFromShop} />
        </section>
      ) : null}

      <ReviewList page={reviews} title={m.catalog.reviews.title} />
    </div>
  );
}

function ProductSkeleton({ m }: { m: Messages }) {
  return (
    <div>
      <BlockSkeleton className="mb-4 h-4 w-64" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3.5fr)]">
        <div className="card squares aspect-square" />
        <div className="flex flex-col gap-3">
          <BlockSkeleton className="h-4 w-24" />
          <BlockSkeleton className="h-10 w-4/5" />
          <BlockSkeleton className="h-4 w-1/2" />
          <BlockSkeleton className="mt-4 h-8 w-40" />
          <BlockSkeleton className="h-20" />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <BuyBoxSkeleton m={m} />
        </div>
      </div>
    </div>
  );
}

export default async function ProductPage(props: PageProps<"/[lang]/p/[id]">) {
  const m = await getMessages();
  return (
    <Suspense fallback={<ProductSkeleton m={m} />}>
      <ProductPageContent params={props.params} />
    </Suspense>
  );
}
