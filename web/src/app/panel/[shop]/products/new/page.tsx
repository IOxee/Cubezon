import type { Metadata } from "next";
import { Suspense } from "react";
import { m } from "@/i18n";
import { requireSellerShop } from "@/lib/data/seller";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { DepositHelp } from "@/components/seller/deposit-help";
import { Notice } from "@/components/ui/notice";
import { PanelHeader, PanelSkeleton } from "../../../_components/panel-ui";
import { ListingForm } from "../_components/listing-form";
import { saveListingAction } from "../actions";

export const metadata: Metadata = { title: m.seller.meta.newListing };

export default function NewListingPage({ params }: PageProps<"/panel/[shop]/products/new">) {
  return (
    <>
      <PanelHeader title={m.seller.meta.newListing} />
      <Suspense fallback={<PanelSkeleton rows={5} />}>
        <NewListing params={params} />
      </Suspense>
    </>
  );
}

async function NewListing({ params }: { params: PageProps<"/panel/[shop]/products/new">["params"] }) {
  const { shop: shopSlug } = await params;
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "products", "new"), {
    permission: "products.manage",
  });
  if (!canEditShop(shop.status)) return <Notice tone="danger">{m.seller.listings.suspended}</Notice>;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="card p-5">
        <ListingForm action={saveListingAction.bind(null, shop.slug)} backHref={panelPath(shop.slug, "products")} />
      </div>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <DepositHelp approved={shop.status === "APPROVED"} />
      </aside>
    </div>
  );
}
