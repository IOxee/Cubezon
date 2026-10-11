import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, m } from "@/i18n";
import { getExpressSettings } from "@/lib/data/delivery";
import { getShopListings, requireSellerShop, type SellerShop } from "@/lib/data/seller";
import {
  shopExpressFeeCents,
  shopExpressFeeMaxCents,
  shopsSetExpressFee,
  type ExpressSettings,
} from "@/lib/delivery";
import { formatMoney, fromCents, toCents } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { publicLocation } from "@/lib/seller/profile";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { priceInputValue } from "@/lib/seller/validation";
import type { ShopZone } from "@/lib/seller/storage";
import { shopMediaUrl } from "@/lib/shop-media";
import { ShopHeader } from "@/components/catalog/shop-header";
import { ExpressFeeForm } from "@/components/seller/express-fee-form";
import { ShopForm } from "@/components/seller/shop-form";
import { ShopImageForm } from "@/components/seller/shop-image-form";
import { ShopProfileForm, type FeaturedOption } from "@/components/seller/shop-profile-form";
import { ShopStatusStamp } from "@/components/seller/shop-status";
import { Notice } from "@/components/ui/notice";
import { PanelHeader, PanelSkeleton } from "../../_components/panel-ui";
import { shopImageAction, updateExpressFeeAction, updateShopAction, updateShopProfileAction } from "./actions";

export const metadata: Metadata = { title: m.seller.meta.shop };

type Props = PageProps<"/panel/[shop]/shop">;

/** Shop settings and public profile. Owner only: employees get a 404 (requireSellerShop). */
export default function ShopSettingsPage({ params, searchParams }: Props) {
  return (
    <>
      <PanelHeader title={m.seller.panel.nav.shop} />
      <Suspense fallback={<PanelSkeleton rows={5} />}>
        <ShopSettings params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ShopSettings({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ shop: shopSlug }, query] = await Promise.all([params, searchParams]);
  const { player, shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "shop"), { ownerOnly: true });
  const editable = canEditShop(shop.status);
  const [listings, express] = await Promise.all([editable ? getShopListings(shop.id) : [], getExpressSettings()]);
  const featuredOptions: FeaturedOption[] = listings
    .filter((listing) => listing.status === "ACTIVE")
    .map((listing) => ({ id: listing.id, title: listing.title, material: listing.material, available: listing.available }));
  const logoUrl = shopMediaUrl(shop.logoPath);
  const bannerUrl = shopMediaUrl(shop.bannerPath);
  // After a slug change the action redirects here with ?notice=saved (the form state is lost).
  const savedFlash = query.notice === "saved";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        {editable ? null : <Notice tone="danger">{m.seller.errors.suspended}</Notice>}

        {editable ? (
          <section aria-labelledby="shop-details" className="card p-5">
            <h2 id="shop-details" className="text-xl">
              {m.seller.settings.details}
            </h2>
            <p className="mt-1 mb-5 text-sm text-ink-2">{m.seller.settings.detailsLead}</p>
            {savedFlash ? (
              <Notice tone="success" className="mb-5">
                {m.seller.shopForm.saved}
              </Notice>
            ) : null}
            <ShopForm
              action={updateShopAction.bind(null, shop.slug)}
              initial={{ name: shop.name, slug: shop.slug, description: shop.description, ink: shop.ink }}
              slugHint={m.seller.shopForm.slugHintExisting}
              logoUrl={logoUrl}
              submitLabel={m.seller.shopForm.save}
              pendingLabel={m.seller.shopForm.saving}
              savedMessage={m.seller.shopForm.saved}
            />
          </section>
        ) : null}

        <section id="perfil" aria-labelledby="shop-profile" className="card scroll-mt-4 p-5">
          <h2 id="shop-profile" className="text-xl">
            {m.seller.profile.title}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{m.seller.profile.lead}</p>

          <div className="mt-5">
            <p className="label">{m.seller.profile.preview}</p>
            <p className="mb-2 text-xs text-ink-3">{m.seller.profile.previewHint}</p>
            <ShopHeader
              headingAs="p"
              shop={{
                name: shop.name,
                ink: shop.ink,
                official: shop.official,
                tagline: shop.tagline,
                description: shop.description,
                ownerName: player.name,
                createdAt: "",
                logoUrl,
                bannerUrl,
                location: publicLocation(shop.showLocation, shop.zone),
              }}
            />
          </div>

          {editable ? (
            <>
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="mb-4 text-lg">{m.seller.images.title}</h3>
                <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
                  <ShopImageForm
                    kind="logo"
                    action={shopImageAction.bind(null, shop.slug, "logo")}
                    currentUrl={logoUrl}
                    name={shop.name}
                    ink={shop.ink}
                  />
                  <ShopImageForm
                    kind="banner"
                    action={shopImageAction.bind(null, shop.slug, "banner")}
                    currentUrl={bannerUrl}
                    name={shop.name}
                    ink={shop.ink}
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <ShopProfileForm
                  action={updateShopProfileAction.bind(null, shop.slug)}
                  initial={{
                    tagline: shop.tagline,
                    featuredListingIds: shop.featuredListingIds,
                    showLocation: shop.showLocation,
                  }}
                  options={featuredOptions}
                  hasZone={shop.zone !== null}
                />
              </div>
            </>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 lg:self-start">
        <StatusCard shop={shop} />
        {editable && express.enabled && shopsSetExpressFee(express) ? <ExpressFeeCard shop={shop} express={express} /> : null}
        <ZoneCard zone={shop.zone} />
      </aside>
    </div>
  );
}

/** Status of the shop, its public address and the way to it (or to fix the request). */
function StatusCard({ shop }: { shop: SellerShop }) {
  const publicPath = `/t/${shop.slug}`;
  return (
    <section aria-labelledby="shop-public" className="card p-4" style={inkStyle(shop.ink)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="shop-public" className="text-lg">
          {m.seller.overview.statusTitle}
        </h2>
        <ShopStatusStamp status={shop.status} />
      </div>
      <p className="mt-2 text-sm text-ink-2">{m.seller.overview.status[shop.status]}</p>
      <p className="num mt-3 truncate border-2 border-dashed border-line bg-paper px-2 py-1 text-sm">{publicPath}</p>
      {shop.status === "APPROVED" ? (
        <Link href={publicPath} className="btn btn-sm mt-3">
          {m.seller.panel.viewShop}
        </Link>
      ) : null}
      {shop.status === "REJECTED" ? (
        <Link href={`/sell#shop-${shop.slug}`} className="btn btn-sm mt-3">
          {m.seller.overview.fixRequest}
        </Link>
      ) : null}
    </section>
  );
}

/**
 * The shop's own express fee, while the server lets shops set it: the server's fee, the cap
 * (shop-capped) and what the shop charges now.
 */
function ExpressFeeCard({ shop, express }: { shop: SellerShop; express: ExpressSettings }) {
  const t = m.seller.expressFee;
  const ownCents = shop.expressFee === null ? null : toCents(shop.expressFee);
  const money = (cents: number) => formatMoney(fromCents(cents));
  return (
    <section aria-labelledby="shop-express-fee" className="card p-4">
      <h2 id="shop-express-fee" className="text-lg">
        {t.title}
      </h2>
      <p className="mt-1 mb-3 text-sm text-ink-2">{t.lead}</p>
      <dl className="mb-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-2">{t.serverFee}</dt>
        <dd className="num text-right">{money(express.feeCents)}</dd>
        {express.pricing === "shop-capped" ? (
          <>
            <dt className="text-ink-2">{t.cap}</dt>
            <dd className="num text-right">{money(express.maxFeeCents)}</dd>
          </>
        ) : null}
        <dt className="font-semibold">{t.current}</dt>
        <dd className="num text-right font-semibold">{money(shopExpressFeeCents(express, ownCents))}</dd>
      </dl>
      <ExpressFeeForm
        key={ownCents ?? ""}
        action={updateExpressFeeAction.bind(null, shop.slug)}
        initial={shop.expressFee === null ? "" : priceInputValue(shop.expressFee)}
        serverFeeLabel={money(express.feeCents)}
        maxLabel={money(shopExpressFeeMaxCents(express))}
      />
    </section>
  );
}

function coords(x: number, y: number, z: number): string {
  return fmt(m.seller.zone.coords, { x, y, z });
}

/** Where the shop's storage blocks count in the game (set by an admin, read only here). */
function ZoneCard({ zone }: { zone: ShopZone | null }) {
  const t = m.seller.zone;
  return (
    <section aria-labelledby="shop-zone" className="card-soft p-4">
      <h2 id="shop-zone" className="mb-3 text-lg">
        {t.title}
      </h2>
      {zone ? (
        <>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="label">{t.world}</dt>
              <dd className="num break-all">{zone.world}</dd>
            </div>
            <div>
              <dt className="label">{t.from}</dt>
              <dd className="num">{coords(zone.minX, zone.minY, zone.minZ)}</dd>
            </div>
            <div>
              <dt className="label">{t.to}</dt>
              <dd className="num">{coords(zone.maxX, zone.maxY, zone.maxZ)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-3">{t.hint}</p>
        </>
      ) : (
        <p className="text-sm text-ink-2">{m.seller.storage.noZone}</p>
      )}
    </section>
  );
}
