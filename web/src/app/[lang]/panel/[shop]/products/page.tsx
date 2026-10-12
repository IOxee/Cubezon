import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Locale, type Messages } from "@/i18n";
import { itemName } from "@/i18n/items";
import { getFormat, getLocale, getMessages } from "@/i18n/server";
import { getShopListings, getShopSales, requireSellerShop, type SellerListing } from "@/lib/data/seller";
import type { Format } from "@/lib/format";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop, canRemoveListing, type ListingStatus } from "@/lib/seller/stats";
import { CommandText } from "@/components/seller/command-text";
import { ListingStatusBadge } from "@/components/seller/shop-status";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { Price } from "@/components/ui/price";
import { SubmitButton } from "@/components/ui/submit-button";
import { PanelHeader, PanelSkeleton, ShopPanelLink, ShopPanelLinkFallback } from "../../_components/panel-ui";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { RestoreAction } from "./_components/restore-action";
import { changeListingStatusAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.seller.meta.listings };
}

const STATUS_ORDER: Record<ListingStatus, number> = { ACTIVE: 0, PAUSED: 1, REMOVED: 2 };
const NEW_LISTING_CLASS = "btn btn-primary btn-sm";

type Props = PageProps<"/[lang]/panel/[shop]/products">;

export default async function ListingsPage({ params, searchParams }: Props) {
  const m = await getMessages();
  return (
    <>
      <PanelHeader
        title={m.seller.listings.title}
        action={
          <Suspense fallback={<ShopPanelLinkFallback className={NEW_LISTING_CLASS}>{m.seller.listings.new}</ShopPanelLinkFallback>}>
            <ShopPanelLink params={params} segments={["products", "new"]} permission="products.manage" className={NEW_LISTING_CLASS}>
              {m.seller.listings.new}
            </ShopPanelLink>
          </Suspense>
        }
      />
      <Suspense fallback={<PanelSkeleton rows={6} />}>
        <Listings params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Row = SellerListing & { sold: number; openOrders: number };

async function Listings({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ shop: shopSlug }, query] = await Promise.all([params, searchParams]);
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "products"));
  const [listings, sales, m, f, locale] = await Promise.all([
    getShopListings(shop.id),
    getShopSales(shop.id),
    getMessages(),
    getFormat(),
    getLocale(),
  ]);
  // Without products.manage an employee only sees the products (and their stock).
  const editable = canEditShop(shop.status) && shop.permissions.includes("products.manage");
  const rows: Row[] = listings
    .map((listing) => {
      const figures = sales.byListing.get(listing.id);
      return { ...listing, sold: figures?.unitsSold ?? 0, openOrders: figures?.openOrders ?? 0 };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const flash =
    query.notice === "created" ? m.seller.listings.flash.created : query.notice === "saved" ? m.seller.listings.flash.saved : null;

  return (
    <div className="space-y-4">
      {flash ? (
        <Notice tone="success">
          <CommandText text={flash} command={m.commands.deposit} />
        </Notice>
      ) : null}
      {!canEditShop(shop.status) ? <Notice tone="danger">{m.seller.listings.suspended}</Notice> : null}
      {canEditShop(shop.status) && !editable ? <Notice>{m.seller.listings.readOnly}</Notice> : null}
      {shop.status === "PENDING" || shop.status === "REJECTED" ? <Notice>{m.seller.listings.notPublic}</Notice> : null}

      {rows.length === 0 ? (
        <EmptyState
          icon="oak_sign"
          title={m.seller.listings.empty.title}
          body={m.seller.listings.empty.body}
          action={
            editable ? (
              <Link href={panelPath(shop.slug, "products", "new")} className="btn btn-primary">
                {m.seller.listings.empty.cta}
              </Link>
            ) : null
          }
        />
      ) : (
        <ListingsTable shopSlug={shop.slug} rows={rows} editable={editable} m={m} f={f} locale={locale} />
      )}
    </div>
  );
}

function ListingsTable({
  shopSlug,
  rows,
  editable,
  m,
  f,
  locale,
}: {
  shopSlug: string;
  rows: Row[];
  editable: boolean;
  m: Messages;
  f: Format;
  locale: Locale;
}) {
  const columns = m.seller.listings.columns;
  return (
    <div className="overflow-x-auto border-2 border-edge bg-surface">
      <table className="w-full min-w-[820px] text-sm">
        <caption className="sr-only">{m.seller.listings.caption}</caption>
        <thead>
          <tr className="border-b-2 border-edge text-left">
            <th scope="col" className="label w-14 px-3 py-2">
              <span className="sr-only">{columns.item}</span>
            </th>
            <th scope="col" className="label px-3 py-2">{columns.title}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.price}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.unit}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.stock}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.sold}</th>
            <th scope="col" className="label px-3 py-2">{columns.status}</th>
            <th scope="col" className="label px-3 py-2 text-right">{columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`border-b border-line last:border-b-0 ${row.status === "REMOVED" ? "text-ink-3" : ""}`}>
              <td className="px-3 py-2">
                <span className="squares flex size-10 items-center justify-center">
                  <ItemIcon material={row.material} size={28} />
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="line-clamp-1 font-semibold">{row.title}</span>
                <span className="num block text-xs text-ink-3">{itemName(row.material, locale)}</span>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Price amount={row.unitPrice} size="sm" />
                {row.unitAmount > 1 ? (
                  <span className="block text-xs text-ink-3">
                    {fmt(m.money.perItem, { price: f.money(row.unitPrice / row.unitAmount) })}
                  </span>
                ) : null}
              </td>
              <td className="num px-3 py-2 text-right">{fmt(m.product.unitShort, { count: row.unitAmount })}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <span className={`num font-semibold ${row.available === 0 && row.status === "ACTIVE" ? "text-danger" : ""}`}>
                  {f.integer(row.available)}
                </span>
                {row.reserved > 0 ? (
                  <span className="block text-xs text-ink-3">{plural(row.reserved, m.seller.listings.reserved)}</span>
                ) : null}
              </td>
              <td className="num px-3 py-2 text-right">{f.integer(row.sold)}</td>
              <td className="px-3 py-2">
                <ListingStatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2">
                {!editable ? (
                  <span className="block text-right">{m.common.none}</span>
                ) : row.status === "REMOVED" ? (
                  <RestoreAction shopSlug={shopSlug} id={row.id} />
                ) : (
                  <RowActions shopSlug={shopSlug} row={row} m={m} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ shopSlug, row, m }: { shopSlug: string; row: Row; m: Messages }) {
  const t = m.seller.listings;
  const removable = canRemoveListing(row);
  const changeStatus = changeListingStatusAction.bind(null, shopSlug);
  return (
    <div className="flex justify-end gap-1">
      <Link href={panelPath(shopSlug, "products", row.id)} className="btn btn-sm">
        {t.edit}
      </Link>
      <form action={changeStatus}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="status" value={row.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
        <SubmitButton className="btn btn-sm btn-ghost">{row.status === "ACTIVE" ? t.pause : t.activate}</SubmitButton>
      </form>
      <form action={changeStatus}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="status" value="REMOVED" />
        <ConfirmSubmit
          message={fmt(t.confirmRemove, { title: row.title })}
          blockedReason={removable ? undefined : t.cannotRemove}
          className="btn btn-sm btn-ghost btn-danger"
        >
          {t.remove}
        </ConfirmSubmit>
      </form>
    </div>
  );
}
