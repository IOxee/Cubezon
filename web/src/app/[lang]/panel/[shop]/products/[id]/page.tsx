import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fmt, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { isUuid } from "@/lib/data/catalog";
import { getShopListing, requireSellerShop, type SellerListing } from "@/lib/data/seller";
import { serialOf, type Format } from "@/lib/format";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop, isListingFormatLocked } from "@/lib/seller/stats";
import { DepositHelp } from "@/components/seller/deposit-help";
import { ListingStatusBadge } from "@/components/seller/shop-status";
import { Notice } from "@/components/ui/notice";
import { PanelHeader, PanelSkeleton } from "../../../_components/panel-ui";
import { ListingForm } from "../_components/listing-form";
import { RestoreAction } from "../_components/restore-action";
import { itemInputValue } from "@/lib/seller/validation";
import { saveListingAction } from "../actions";
import { listingPhotoAction } from "../photo-actions";
import { ListingPhotoForm } from "@/components/seller/listing-photo-form";
import { listingPhotoUrl } from "@/lib/listing-photos";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.seller.meta.editListing };
}

type Props = PageProps<"/[lang]/panel/[shop]/products/[id]">;

export default async function EditListingPage({ params, searchParams }: Props) {
  const m = await getMessages();
  return (
    <>
      <PanelHeader title={m.seller.meta.editListing} />
      <Suspense fallback={<PanelSkeleton rows={5} />}>
        <EditListing params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EditListing({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ shop: shopSlug, id }, query] = await Promise.all([params, searchParams]);
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "products", id));
  if (!isUuid(id)) notFound();
  // Filtered by the shop: a listing of another shop (even another of the player's) is a 404 here.
  const listing = await getShopListing(shop.id, id);
  if (!listing) notFound();

  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const manages = shop.permissions.includes("products.manage");
  const editable = canEditShop(shop.status) && manages && listing.status !== "REMOVED";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          <span className="num">{fmt(m.common.serial, { serial: serialOf(listing.id) })}</span>
          <ListingStatusBadge status={listing.status} />
        </p>
        {query.notice === "restored" && listing.status !== "REMOVED" ? (
          <Notice tone="success">{m.seller.listingForm.restored}</Notice>
        ) : null}
        {listing.status === "REMOVED" ? (
          <Notice>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>{m.seller.listingForm.removed}</p>
              {canEditShop(shop.status) && manages ? <RestoreAction shopSlug={shop.slug} id={listing.id} className="btn btn-sm btn-ink" /> : null}
            </div>
          </Notice>
        ) : null}
        {!canEditShop(shop.status) ? <Notice tone="danger">{m.seller.listings.suspended}</Notice> : null}
        {canEditShop(shop.status) && !manages ? <Notice>{m.seller.listings.readOnly}</Notice> : null}
        {editable ? (
          <div className="card p-5">
            <ListingForm
              action={saveListingAction.bind(null, shop.slug)}
              backHref={panelPath(shop.slug, "products")}
              formatLocked={isListingFormatLocked(listing)}
              listing={{
                id: listing.id,
                title: listing.title,
                description: listing.description,
                material: listing.material,
                item: itemInputValue(listing),
                unitAmount: listing.unitAmount,
                unitPrice: listing.unitPrice,
                status: listing.status === "PAUSED" ? "PAUSED" : "ACTIVE",
              }}
            />
          </div>
        ) : null}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {editable ? (
          <div className="card p-4">
            <ListingPhotoForm
              action={listingPhotoAction.bind(null, shop.slug, listing.id)}
              currentUrl={listingPhotoUrl(listing.photoPath)}
              title={listing.title}
              material={listing.material}
            />
          </div>
        ) : null}
        <InventoryCard listing={listing} m={m} f={f} />
        {editable ? (
          <DepositHelp material={listing.material} unitAmount={listing.unitAmount} approved={shop.status === "APPROVED"} />
        ) : null}
      </aside>
    </div>
  );
}

const INVENTORY_KEYS = ["available", "reserved", "delivered", "returned"] as const;

/** Stock of the listing: the seller's own escrow units, so the figures are shown in full. */
function InventoryCard({ listing, m, f }: { listing: SellerListing; m: Messages; f: Format }) {
  const t = m.seller.listingForm.inventory;
  return (
    <section aria-labelledby="listing-inventory" className="card p-4">
      <h2 id="listing-inventory" className="mb-3 text-lg">
        {t.title}
      </h2>
      <dl className="grid grid-cols-2 gap-3">
        {INVENTORY_KEYS.map((key) => (
          <div key={key} className="border-l-2 border-line pl-2">
            <dt className="label">{t[key]}</dt>
            <dd className="num text-xl font-semibold">{f.integer(listing[key])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
