import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { m, plural } from "@/i18n";
import { countShopComputers, countShopMembers, getOrdersMode } from "@/lib/data/roleplay";
import {
  getShopListings,
  getShopOrders,
  getShopSales,
  getShopStorage,
  requireSellerShop,
  type PanelShop,
  type SellerListing,
  type SellerShop,
} from "@/lib/data/seller";
import { formatInteger, fromCents } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { panelPath } from "@/lib/seller/shops";
import { isLowStock } from "@/lib/seller/stats";
import type { OrdersMode } from "@/lib/order-display";
import { CommandText } from "@/components/seller/command-text";
import { OrdersTable } from "@/components/seller/orders-table";
import { ShopStatusStamp } from "@/components/seller/shop-status";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { SectionHeader } from "@/components/ui/section-header";
import { PanelHeader, PanelSkeleton, ShopPanelLink, ShopPanelLinkFallback, StatTile } from "../_components/panel-ui";
import { StorageCard } from "./_components/storage-card";

export const metadata: Metadata = { title: m.seller.meta.overview };

const RECENT_ORDERS = 5;
const LOW_STOCK_ITEMS = 6;
const NEW_LISTING_CLASS = "btn btn-primary btn-sm";

export default function ShopOverviewPage({ params }: PageProps<"/panel/[tienda]">) {
  return (
    <>
      <PanelHeader
        title={m.seller.overview.title}
        action={
          <Suspense fallback={<ShopPanelLinkFallback className={NEW_LISTING_CLASS}>{m.seller.listings.new}</ShopPanelLinkFallback>}>
            <ShopPanelLink params={params} segments={["productos", "nuevo"]} permission="products.manage" className={NEW_LISTING_CLASS}>
              {m.seller.listings.new}
            </ShopPanelLink>
          </Suspense>
        }
      />
      <Suspense fallback={<PanelSkeleton />}>
        <Overview params={params} />
      </Suspense>
    </>
  );
}

async function Overview({ params }: { params: PageProps<"/panel/[tienda]">["params"] }) {
  const { tienda } = await params;
  const { shop } = await requireSellerShop(tienda, panelPath(tienda));
  const [listings, sales, recent, storage, { mode, computer }] = await Promise.all([
    getShopListings(shop.id),
    getShopSales(shop.id),
    getShopOrders(shop.id, { pageSize: RECENT_ORDERS }),
    getShopStorage(shop.id),
    getRoleplayStatus(shop.id),
  ]);
  const stock = listings.reduce((sum, listing) => sum + (listing.status === "REMOVED" ? 0 : listing.available), 0);
  const lowStock = listings
    .filter(isLowStock)
    .sort((a, b) => a.available - b.available)
    .slice(0, LOW_STOCK_ITEMS);
  const kpis = m.seller.overview.kpis;

  return (
    <div className="space-y-8">
      {computer && computer.computers === 0 && shop.status === "APPROVED" ? <MissingComputer shop={shop} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={kpis.unitsSold}
          hint={kpis.unitsSoldHint}
          value={<span className="num font-semibold">{formatInteger(sales.unitsSold)}</span>}
        />
        <StatTile label={kpis.revenue} hint={kpis.revenueHint} value={<Price amount={fromCents(sales.revenueCents)} size="xl" />} />
        <StatTile
          label={kpis.openOrders}
          hint={kpis.openOrdersHint}
          value={<span className="num font-semibold">{formatInteger(sales.openOrders)}</span>}
        />
        <StatTile label={kpis.stock} hint={kpis.stockHint} value={<span className="num font-semibold">{formatInteger(stock)}</span>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <SectionHeader title={m.seller.overview.recentOrders} href={panelPath(shop.slug, "pedidos")} />
          {recent.orders.length > 0 ? (
            <OrdersTable orders={recent.orders} caption={m.seller.overview.recentOrders} mode={mode} />
          ) : (
            <EmptyState icon="chest" title={m.seller.overview.noOrders.title} body={m.seller.overview.noOrders.body} />
          )}
        </section>
        <div className="space-y-6">
          <ShopStatusPanel shop={shop} />
          {computer ? <ComputerCard shop={shop} computers={computer.computers} employees={computer.employees} /> : null}
          <StorageCard zone={shop.zone} storage={storage} />
          <LowStock shop={shop} listings={lowStock} />
        </div>
      </div>
    </div>
  );
}

/**
 * Order mode of the plugin and, in roleplay mode, what the shop needs to handle its orders: the
 * company computers placed in its zone and the employees who can use them.
 */
async function getRoleplayStatus(
  shopId: string,
): Promise<{ mode: OrdersMode; computer: { computers: number; employees: number } | null }> {
  const mode = await getOrdersMode();
  if (mode !== "roleplay") return { mode, computer: null };
  const [computers, employees] = await Promise.all([countShopComputers(shopId), countShopMembers(shopId)]);
  return { mode, computer: { computers, employees } };
}

function ShopStatusPanel({ shop }: { shop: PanelShop }) {
  return (
    <section aria-labelledby="panel-status" className="card p-4" style={inkStyle(shop.ink)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="panel-status" className="text-lg">
          {m.seller.overview.statusTitle}
        </h2>
        <ShopStatusStamp status={shop.status} />
      </div>
      <p className="mt-2 text-sm text-ink-2">{m.seller.overview.status[shop.status]}</p>
      {shop.status === "APPROVED" ? (
        <Link href={`/t/${shop.slug}`} className="link mt-2 inline-block text-sm font-semibold text-shop">
          {m.seller.panel.viewShop}
        </Link>
      ) : null}
      {shop.status === "REJECTED" && shop.role === "owner" ? (
        <Link href={`/vender#tienda-${shop.slug}`} className="btn btn-sm mt-3">
          {m.seller.overview.fixRequest}
        </Link>
      ) : null}
    </section>
  );
}

/** Roleplay warning: without a company computer the shop cannot accept orders and they expire. */
function MissingComputer({ shop }: { shop: SellerShop }) {
  const t = m.roleplay.panel.computer;
  return (
    <Notice tone="danger">
      <p className="font-semibold">{t.missingTitle}</p>
      <p className="mt-1">
        <CommandText text={t.missing} command={m.roleplay.commands.computerBuy} />
      </p>
      {shop.zone ? null : <p className="mt-1">{t.missingNoZone}</p>}
    </Notice>
  );
}

/** Roleplay mode: company computers in the shop zone and who can use them (owner manages them). */
function ComputerCard({ shop, computers, employees }: { shop: PanelShop; computers: number; employees: number }) {
  const t = m.roleplay.panel.computer;
  return (
    <section aria-labelledby="panel-computer" className="card p-4">
      <h2 id="panel-computer" className="text-lg">
        {t.title}
      </h2>
      <p className={`mt-1 text-sm font-semibold ${computers === 0 ? "text-danger" : ""}`}>{plural(computers, t.count)}</p>
      <p className="mt-2 text-sm text-ink-2">
        {computers === 0 ? <CommandText text={t.buy} command={m.roleplay.commands.computerBuy} /> : t.ok}
      </p>
      <p className="mt-2 text-sm text-ink-2">{plural(employees, t.employees)}</p>
      {shop.role === "owner" ? (
        <Link href={panelPath(shop.slug, "empleados")} className="btn btn-sm mt-3">
          {t.manageEmployees}
        </Link>
      ) : null}
    </section>
  );
}

function LowStock({ shop, listings }: { shop: SellerShop; listings: SellerListing[] }) {
  return (
    <section aria-labelledby="panel-low-stock" className="card-soft p-4">
      <h2 id="panel-low-stock" className="mb-3 text-lg">
        {m.seller.overview.lowStock}
      </h2>
      {listings.length === 0 ? (
        <p className="text-sm text-ink-3">{m.seller.overview.lowStockEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center gap-3">
              <span className="squares flex size-10 shrink-0 items-center justify-center">
                <ItemIcon material={listing.material} size={28} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{listing.title}</p>
                <p className={`text-xs ${listing.available === 0 ? "text-danger" : "text-ink-3"}`}>
                  {plural(listing.available, m.seller.overview.stockLeft)}
                </p>
              </div>
              <Link href={panelPath(shop.slug, "productos", listing.id)} className="btn btn-sm shrink-0">
                {m.seller.overview.restock}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
