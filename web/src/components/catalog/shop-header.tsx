import { fmt } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { inkStyle } from "@/lib/inks";
import type { ShopZone } from "@/lib/seller/storage";
import { worldName } from "@/components/shopping/world-name";
import { ShopSeal } from "@/components/ui/shop-mark";
import { Stamp } from "@/components/ui/stamp";

export type ShopHeaderData = {
  name: string;
  ink: string;
  official: boolean;
  tagline: string;
  description: string;
  ownerName: string;
  /** Empty string to leave out "En Cubezon desde…". */
  createdAt: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  /** Zone to show, already filtered with publicLocation(). */
  location: ShopZone | null;
};

export type ShopHeaderStat = { label: string; value: string };

/** Where the shop is in the game: world and the corners of its zone, in mono. */
export async function ShopLocation({ zone }: { zone: ShopZone }) {
  const m = await getMessages();
  const t = m.catalog.shop.location;
  const coords = (x: number, y: number, z: number) => fmt(t.coords, { x, y, z });
  return (
    <p className="mt-3 text-sm">
      <span className="label mr-2">{t.title}</span>
      <span className="num break-words text-ink-2">
        {fmt(t.value, {
          world: worldName(m, zone.world),
          from: coords(zone.minX, zone.minY, zone.minZ),
          to: coords(zone.maxX, zone.maxY, zone.maxZ),
        })}
      </span>
    </p>
  );
}

/**
 * Head of a storefront: banner (or the ink strip), logo or seal, name, tagline, owner,
 * description, location and the shop's numbers. The seller panel reuses it as a preview, with
 * the name as a paragraph (headingAs="p") and without numbers.
 */
export async function ShopHeader({
  shop,
  stats = [],
  headingAs: Heading = "h1",
}: {
  shop: ShopHeaderData;
  stats?: ShopHeaderStat[];
  headingAs?: "h1" | "p";
}) {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.shop;
  return (
    <header className="card relative overflow-hidden" style={inkStyle(shop.ink)}>
      {shop.bannerUrl ? (
        <div className="squares aspect-[3/1] border-b-2 border-edge sm:aspect-[4/1]">
          {/* eslint-disable-next-line @next/next/no-img-element -- user image from the public Storage bucket */}
          <img
            src={shop.bannerUrl}
            alt={fmt(m.catalog.media.bannerAlt, { name: shop.name })}
            width={1200}
            height={300}
            decoding="async"
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <div aria-hidden className={shop.bannerUrl ? "h-1.5 bg-shop" : "h-3 bg-shop"} />
      <div
        className={`grid gap-6 p-5 md:items-center md:p-6 ${
          stats.length > 0 ? "md:grid-cols-[auto_minmax(0,1fr)_auto]" : "sm:grid-cols-[auto_minmax(0,1fr)]"
        }`}
      >
        <ShopSeal name={shop.name} ink={shop.ink} size={88} logoUrl={shop.logoUrl} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Heading className="text-2xl font-bold tracking-[-0.01em] text-shop [font-stretch:75%] md:text-3xl">
              {shop.name}
            </Heading>
            {shop.official ? (
              <Stamp tone="shop" rotate={-5}>
                {m.catalog.shops.official}
              </Stamp>
            ) : null}
          </div>
          {shop.tagline ? <p className="mt-1 text-lg font-semibold text-ink-2">{shop.tagline}</p> : null}
          <p className="mt-1 text-sm text-ink-2">
            {fmt(t.owner, { name: shop.ownerName })}
            {shop.createdAt ? (
              <span className="text-ink-3"> · {fmt(t.since, { date: f.date(shop.createdAt) })}</span>
            ) : null}
          </p>
          <p className={`mt-3 max-w-prose whitespace-pre-line ${shop.description ? "" : "text-ink-3"}`}>
            {shop.description || m.catalog.shops.noDescription}
          </p>
          {shop.location ? <ShopLocation zone={shop.location} /> : null}
        </div>
        {stats.length > 0 ? (
          <dl className="grid grid-cols-3 border-2 border-edge bg-paper md:grid-cols-1">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`px-4 py-2 ${index > 0 ? "border-l border-line md:border-t md:border-l-0" : ""}`}
              >
                <dt className="label">{stat.label}</dt>
                <dd className="num text-lg font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
