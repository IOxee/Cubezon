import Link from "next/link";
import { fmt, m } from "@/i18n";
import type { CatalogItem } from "@/lib/data/catalog";
import { serialOf } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { ListingVisual } from "@/components/catalog/listing-visual";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { Stamp } from "@/components/ui/stamp";

/** Catalog card drawn as a coupon: icon on ruled squares, perforation, then the data. */
export function ProductCard({ item }: { item: CatalogItem }) {
  const soldOut = item.unitsAvailable === 0;
  return (
    <article className="lift card relative flex flex-col" style={inkStyle(item.shop.ink)}>
      <div className="squares relative flex aspect-[4/3] items-center justify-center">
        <ListingVisual item={item} iconSize={64} />
        <span className="num absolute top-1.5 right-2 text-xs text-ink-3">{serialOf(item.id)}</span>
        {item.unitAmount > 1 ? (
          <span className="badge badge-paper absolute bottom-1.5 left-2">{fmt(m.product.unitShort, { count: item.unitAmount })}</span>
        ) : null}
        {soldOut ? (
          <Stamp tone="danger" size="md" className="absolute" rotate={-8}>
            {m.common.soldOutStamp}
          </Stamp>
        ) : null}
      </div>
      <div className="perforation" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-base leading-snug font-semibold [font-stretch:100%]">
          <Link href={`/p/${item.id}`} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
            {item.title}
          </Link>
        </h3>
        <p className="truncate text-xs text-shop">{item.shop.name}</p>
        <Rating value={item.ratingAvg} count={item.ratingCount} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price amount={item.unitPrice} size="lg" />
        </div>
      </div>
    </article>
  );
}

const GRID_COLUMNS = {
  full: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  /** Next to a sidebar (search filters). */
  sidebar: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
  /** Up to four featured listings of a storefront. */
  featured: "grid-cols-2 lg:grid-cols-4",
} as const;

export function ProductGrid({ items, layout = "full" }: { items: CatalogItem[]; layout?: keyof typeof GRID_COLUMNS }) {
  return (
    <div className={`grid gap-3 ${GRID_COLUMNS[layout]}`}>
      {items.map((item) => (
        <ProductCard key={item.id} item={item} />
      ))}
    </div>
  );
}
