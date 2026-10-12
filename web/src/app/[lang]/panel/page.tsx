import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { fmt, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { requirePlayer } from "@/lib/auth/session";
import { getPanelShops, getShopsKpis, getShopsStorage, type PanelShop, type SellerShop, type ShopKpis } from "@/lib/data/seller";
import { getShopSlots, type ShopSlots } from "@/lib/data/shop-slots";
import { fromCents, type Format } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { canRequestShop, panelPath } from "@/lib/seller/shops";
import { storageFillPercent, type StorageFigures } from "@/lib/seller/storage";
import { shopMediaUrl } from "@/lib/shop-media";
import { ShopStatusStamp } from "@/components/seller/shop-status";
import { ItemIcon } from "@/components/ui/item-icon";
import { Price } from "@/components/ui/price";
import { ShopSeal } from "@/components/ui/shop-mark";
import { PanelHeader } from "./_components/panel-ui";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.seller.meta.myShops };
}

/**
 * "Mis tiendas": every shop the player owns or works for (shop_members), with its basic figures,
 * and the way to request another (their shop slots only count the shops they own).
 */
export default async function MyShopsPage() {
  const t = (await getMessages()).seller.shops;
  return (
    <>
      <PanelHeader label={t.label} title={t.title} />
      <Suspense fallback={<ShopsSkeleton />}>
        <MyShops />
      </Suspense>
    </>
  );
}

async function MyShops() {
  const player = await requirePlayer("/panel");
  const shops = await getPanelShops(player.uuid);
  if (shops.length === 0) redirect("/sell");

  const ids = shops.map((shop) => shop.id);
  const [kpis, storage, slots, m, f] = await Promise.all([
    getShopsKpis(ids),
    getShopsStorage(ids),
    getShopSlots(player.uuid),
    getMessages(),
    getFormat(),
  ]);

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shops.map((shop) => (
        <li key={shop.id}>
          <ShopCard shop={shop} kpis={kpis.get(shop.id)} storage={storage.get(shop.id)} m={m} f={f} />
        </li>
      ))}
      <li>
        <RequestCard slots={slots} m={m} f={f} />
      </li>
    </ul>
  );
}

function ShopCard({
  shop,
  kpis,
  storage,
  m,
  f,
}: {
  shop: PanelShop;
  kpis?: ShopKpis;
  storage?: StorageFigures;
  m: Messages;
  f: Format;
}) {
  const t = m.seller.shops;
  const labels = t.kpis;
  return (
    <article aria-labelledby={`shop-${shop.id}`} className="card flex h-full flex-col" style={inkStyle(shop.ink)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <ShopSeal name={shop.name} ink={shop.ink} size={48} logoUrl={shopMediaUrl(shop.logoPath)} />
          <div className="min-w-0">
            <h2 id={`shop-${shop.id}`} className="truncate text-lg text-shop">
              <Link href={panelPath(shop.slug)} className="hover:underline">
                {shop.name}
              </Link>
            </h2>
            <p className="num truncate text-xs text-ink-3">/t/{shop.slug}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ShopStatusStamp status={shop.status} />
          {shop.role === "employee" ? <span className="badge badge-paper">{shop.roleName ?? m.panelRole.employee}</span> : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 border-y-2 border-dashed border-line">
        <Kpi label={labels.unitsSold} value={<span className="num font-semibold">{f.integer(kpis?.unitsSold ?? 0)}</span>} />
        <Kpi label={labels.revenue} value={<Price amount={fromCents(kpis?.revenueCents ?? 0)} size="sm" />} />
        <Kpi label={labels.openOrders} value={<span className="num font-semibold">{f.integer(kpis?.openOrders ?? 0)}</span>} />
        <Kpi label={labels.stock} value={<span className="num font-semibold">{f.integer(kpis?.stock ?? 0)}</span>} />
      </dl>

      <StorageLine shop={shop} storage={storage} m={m} f={f} />

      <div className="mt-auto flex flex-wrap gap-2 p-4 pt-0">
        <Link href={panelPath(shop.slug)} className="btn btn-sm btn-ink">
          {t.open}
        </Link>
        {shop.status === "APPROVED" ? (
          <Link href={`/t/${shop.slug}`} className="btn btn-sm">
            {m.seller.panel.viewShop}
          </Link>
        ) : null}
        {shop.status === "REJECTED" && shop.role === "owner" ? (
          <Link href={`/sell#shop-${shop.slug}`} className="btn btn-sm">
            {t.fixRequest}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-dashed border-line px-4 py-2 odd:border-r-2 [&:nth-child(n+3)]:border-t-2">
      <dt className="label">{label}</dt>
      <dd className="text-lg">{value}</dd>
    </div>
  );
}

/** Storage in use against capacity, as a thin bar (the full block is on the shop overview). */
function StorageLine({ shop, storage, m, f }: { shop: SellerShop; storage?: StorageFigures; m: Messages; f: Format }) {
  const t = m.seller.shops;
  const used = storage?.used ?? 0;
  const capacity = storage?.capacity ?? 0;
  const percent = storageFillPercent({ blocks: storage?.blocks ?? 0, capacity, used });
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="label">{t.storage}</span>
        <span className="num text-ink-2">
          {shop.zone
            ? fmt(t.storageUsage, { used: f.integer(used), capacity: f.integer(capacity) })
            : t.noZone}
        </span>
      </div>
      <div aria-hidden className="mt-1 h-2 border border-edge bg-paper">
        <div className={`h-full ${used > 0 && used >= capacity ? "bg-danger" : "bg-ink"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Link to request another shop while a slot is free; otherwise, how to get more slots. */
function RequestCard({ slots, m, f }: { slots: ShopSlots; m: Messages; f: Format }) {
  const t = m.seller.shops;
  const usage = { used: f.integer(slots.used), slots: f.integer(slots.slots) };
  if (!canRequestShop(slots)) {
    return (
      <div className="card-soft flex h-full flex-col gap-2 border-2 border-dashed border-line p-4">
        <p className="font-semibold">{t.limit.title}</p>
        <p className="num text-sm text-ink-2">{fmt(t.limit.usage, usage)}</p>
        <p className="text-sm text-ink-2">{t.limit.body}</p>
      </div>
    );
  }
  return (
    <Link
      href="/sell"
      className="lift flex h-full min-h-48 flex-col items-center justify-center gap-2 border-2 border-dashed border-edge bg-paper p-4 text-center"
    >
      <span className="squares p-2">
        <ItemIcon material="emerald" size={32} />
      </span>
      <span className="font-semibold">{t.another.title}</span>
      <span className="text-sm text-ink-2">{fmt(t.another.body, usage)}</span>
    </Link>
  );
}

async function ShopsSkeleton() {
  const m = await getMessages();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      <span className="sr-only">{m.a11y.loading}</span>
      {[0, 1, 2].map((n) => (
        <div key={n} className="skeleton h-72" />
      ))}
    </div>
  );
}
