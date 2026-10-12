import Link from "next/link";
import { fmt, plural } from "@/i18n";
import type { ShopSummary } from "@/lib/data/shops";
import { getFormat, getMessages } from "@/i18n/server";
import { inkStyle } from "@/lib/inks";
import { shopMediaUrl } from "@/lib/shop-media";
import { Rating } from "@/components/ui/rating";
import { ShopSeal } from "@/components/ui/shop-mark";
import { Stamp } from "@/components/ui/stamp";

/** Shop directory card: ink strip, logo or seal, name, owner, tagline, description and numbers. */
export async function ShopCard({ shop }: { shop: ShopSummary }) {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.shops;
  return (
    <article className="lift card relative flex h-full flex-col" style={inkStyle(shop.ink)}>
      <div aria-hidden className="h-1.5 bg-shop" />
      <div className="flex flex-1 gap-3 p-4">
        <ShopSeal name={shop.name} ink={shop.ink} size={48} logoUrl={shopMediaUrl(shop.logoPath)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg leading-tight">
              <Link href={`/t/${shop.slug}`} className="text-shop after:absolute after:inset-0 hover:underline">
                {shop.name}
              </Link>
            </h3>
            {shop.official ? (
              <Stamp tone="shop" size="sm" rotate={4} className="shrink-0">
                {t.official}
              </Stamp>
            ) : null}
          </div>
          <p className="text-xs text-ink-3">{fmt(t.owner, { name: shop.ownerName })}</p>
          {shop.tagline ? <p className="line-clamp-1 text-sm font-semibold">{shop.tagline}</p> : null}
          <p className="line-clamp-2 text-sm text-ink-2">{shop.description || t.noDescription}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-ink-2">
            <span className="num">{plural(shop.listingCount, t.listings, { count: f.integer(shop.listingCount) })}</span>
            <span className="num">{plural(shop.unitsSold, t.sold, { count: f.integer(shop.unitsSold) })}</span>
            <Rating value={shop.ratingAvg} count={shop.ratingCount} showCount={false} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ShopGrid({ shops }: { shops: ShopSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((shop) => (
        <ShopCard key={shop.id} shop={shop} />
      ))}
    </div>
  );
}
