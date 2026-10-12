import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Messages } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { getCurrentPlayer } from "@/lib/auth/session";
import { getOwnShops, type SellerShop } from "@/lib/data/seller";
import { getShopSlots, type ShopSlots } from "@/lib/data/shop-slots";
import { inkStyle } from "@/lib/inks";
import { canRequestShop, panelPath } from "@/lib/seller/shops";
import { CommandText } from "@/components/seller/command-text";
import { ShopForm } from "@/components/seller/shop-form";
import { ShopStatusStamp } from "@/components/seller/shop-status";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { ShopSeal } from "@/components/ui/shop-mark";
import { requestShopAction, resubmitShopAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return {
    title: m.seller.meta.sell,
    description: m.seller.meta.sellDescription,
  };
}

/** Icons of the three perks, in the order of m.seller.pitch.perks. */
const PERK_ICONS = ["chest", "emerald", "barrel"] as const;

export default async function SellPage() {
  const m = await getMessages();
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <header className="lg:col-start-1">
        <p className="label">{m.seller.pitch.label}</p>
        <h1 className="mt-1 text-2xl md:text-3xl">{m.seller.pitch.title}</h1>
        <p className="mt-3 max-w-2xl text-md text-ink-2">{m.seller.pitch.lead}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {m.seller.pitch.perks.map((perk, index) => (
            <li key={perk.title} className="card-soft flex gap-3 p-3">
              <span className="squares flex size-12 shrink-0 items-center justify-center">
                <ItemIcon material={PERK_ICONS[index]} size={32} />
              </span>
              <span>
                <span className="block font-semibold">{perk.title}</span>
                <span className="block text-sm text-ink-2">{perk.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </header>

      <aside className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <Suspense fallback={<StatusSkeleton m={m} />}>
          <ApplyPanel />
        </Suspense>
      </aside>

      <div className="space-y-8 lg:col-start-1">
        <Suspense fallback={null}>
          <MyShops />
        </Suspense>

        <section aria-labelledby="sell-steps">
          <p className="label">{m.seller.steps.label}</p>
          <h2 id="sell-steps" className="mb-4 text-xl">
            {m.seller.steps.title}
          </h2>
          <ol className="card">
            {m.seller.steps.items.map((step, index) => (
              <li key={step.title} className="flex gap-4 border-b-2 border-dashed border-line p-4 last:border-b-0">
                <span className="num flex size-10 shrink-0 items-center justify-center border-2 border-edge bg-paper text-lg font-semibold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-md font-semibold">{step.title}</span>
                  <span className="block text-sm text-ink-2">
                    <CommandText text={step.body} command={m.commands.deposit} />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="sell-rules" className="card-soft p-4">
          <h2 id="sell-rules" className="mb-3 text-lg">
            {m.seller.rules.title}
          </h2>
          <ul className="space-y-1.5 text-sm">
            {m.seller.rules.items.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-ink" />
                {rule}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** What the visitor can do now: sign in, request a (another) shop, or see they have no free slot. */
async function ApplyPanel() {
  const [m, player] = await Promise.all([getMessages(), getCurrentPlayer()]);
  if (!player) return <SignInGate m={m} />;
  const [shops, slots] = await Promise.all([getOwnShops(player.uuid), getShopSlots(player.uuid)]);
  if (!canRequestShop(slots)) return <LimitCard m={m} slots={slots} hasShops={shops.length > 0} />;
  return <ApplyCard m={m} slots={slots} hasShops={shops.length > 0} />;
}

/** The player's shops and how each request is going (nothing for visitors without shops). */
async function MyShops() {
  const [m, player] = await Promise.all([getMessages(), getCurrentPlayer()]);
  if (!player) return null;
  const [shops, slots] = await Promise.all([getOwnShops(player.uuid), getShopSlots(player.uuid)]);
  if (shops.length === 0) return null;
  const canResubmit = canRequestShop(slots);

  return (
    <section aria-label={m.seller.myShops.title}>
      <SectionHeader label={m.seller.myShops.label} title={m.seller.myShops.title} href="/panel" linkText={m.seller.myShops.seeAll} />
      <ul className="space-y-4">
        {shops.map((shop) => (
          <li key={shop.id} id={`shop-${shop.slug}`} className="scroll-mt-4">
            <ShopStatusCard m={m} shop={shop} canResubmit={canResubmit} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignInGate({ m }: { m: Messages }) {
  return (
    <section aria-labelledby="sell-gate" className="card p-5">
      <span className="squares mb-3 inline-flex p-2">
        <ItemIcon material="name_tag" size={40} />
      </span>
      <h2 id="sell-gate" className="text-xl">
        {m.seller.gate.title}
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        <CommandText text={m.seller.gate.body} command={m.commands.link} />
      </p>
      <Link href={`/login?next=${encodeURIComponent("/sell")}`} className="btn btn-primary btn-block mt-4">
        {m.seller.gate.cta}
      </Link>
    </section>
  );
}

/** "Tienes X de Y tiendas": shops using a slot against the player's slots. */
function SlotsCount({ m, slots }: { m: Messages; slots: ShopSlots }) {
  const t = m.seller.apply;
  return (
    <p className="num mt-1 text-xs text-ink-3">
      {plural(slots.slots, t.count, { used: slots.used })} {t.countHint}
    </p>
  );
}

function ApplyCard({ m, slots, hasShops }: { m: Messages; slots: ShopSlots; hasShops: boolean }) {
  const t = m.seller.apply;
  return (
    <section aria-labelledby="sell-apply" className="card p-5">
      <p className="label">{t.label}</p>
      <h2 id="sell-apply" className="text-xl">
        {hasShops ? t.titleAnother : t.title}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{t.lead}</p>
      <SlotsCount m={m} slots={slots} />
      <div className="mt-5">
        <ShopForm
          action={requestShopAction}
          initial={{ name: "", slug: "", description: "", ink: "azul" }}
          autoSlug
          resetOnSave
          idPrefix="new-shop"
          submitLabel={t.submit}
          pendingLabel={t.submitting}
          savedMessage={t.saved}
        />
      </div>
    </section>
  );
}

/** No free slot: how to get more (and, if they have shops, the way to them; /panel needs one). */
function LimitCard({ m, slots, hasShops }: { m: Messages; slots: ShopSlots; hasShops: boolean }) {
  const t = m.seller.apply.limit;
  return (
    <section aria-labelledby="sell-limit" className="card p-5">
      <span className="squares mb-3 inline-flex p-2">
        <ItemIcon material="barrier" size={40} />
      </span>
      <h2 id="sell-limit" className="text-xl">
        {t.title}
      </h2>
      <SlotsCount m={m} slots={slots} />
      <p className="mt-2 text-sm text-ink-2">{t.body}</p>
      {hasShops ? (
        <Link href="/panel" className="btn btn-block mt-4">
          {t.cta}
        </Link>
      ) : null}
    </section>
  );
}

function ShopStatusCard({ m, shop, canResubmit }: { m: Messages; shop: SellerShop; canResubmit: boolean }) {
  const t = m.seller.shopStatus;
  const showNote = shop.reviewNote && (shop.status === "REJECTED" || shop.status === "SUSPENDED");
  return (
    <article aria-labelledby={`status-${shop.id}`} className="card p-5" style={inkStyle(shop.ink)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ShopSeal name={shop.name} ink={shop.ink} size={48} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-shop [font-stretch:75%]">{shop.name}</p>
            <p className="num truncate text-xs text-ink-3">/t/{shop.slug}</p>
          </div>
        </div>
        <ShopStatusStamp status={shop.status} size="md" />
      </div>

      <h3 id={`status-${shop.id}`} className="mt-4 text-lg">
        {t.title[shop.status]}
      </h3>
      <p className="mt-1 text-sm text-ink-2">{fmt(t.body[shop.status], { name: shop.name })}</p>

      {showNote ? (
        <div className="mt-4 border-l-4 border-danger bg-paper px-3 py-2">
          <p className="label">{t.reviewNote}</p>
          <p className="text-sm whitespace-pre-line">{shop.reviewNote}</p>
        </div>
      ) : null}

      {shop.status === "APPROVED" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={panelPath(shop.slug)} className="btn btn-primary btn-sm">
            {t.goToPanel}
          </Link>
          <Link href={`/t/${shop.slug}`} className="btn btn-sm">
            {t.viewShop}
          </Link>
        </div>
      ) : null}

      {shop.status === "PENDING" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={panelPath(shop.slug, "products")} className="btn btn-ink btn-sm">
            {t.preparePanel}
          </Link>
          <Link href={panelPath(shop.slug)} className="btn btn-sm">
            {t.goToPanel}
          </Link>
        </div>
      ) : null}

      {shop.status === "SUSPENDED" ? (
        <div className="mt-4">
          <Link href={panelPath(shop.slug)} className="btn btn-sm">
            {t.goToPanel}
          </Link>
        </div>
      ) : null}

      {shop.status === "REJECTED" ? (
        <details open className="mt-4 border-t-2 border-dashed border-line pt-4">
          <summary className="label cursor-pointer">{m.seller.apply.fix}</summary>
          <div className="mt-4">
            {canResubmit ? (
              <ShopForm
                action={resubmitShopAction.bind(null, shop.id)}
                initial={{ name: shop.name, slug: shop.slug, description: shop.description, ink: shop.ink }}
                idPrefix={`shop-${shop.id}`}
                submitLabel={m.seller.apply.resubmit}
                pendingLabel={m.seller.apply.submitting}
              />
            ) : (
              <Notice>{m.seller.apply.fixLimit}</Notice>
            )}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function StatusSkeleton({ m }: { m: Messages }) {
  return (
    <div className="card space-y-3 p-5" aria-busy="true">
      <span className="sr-only">{m.a11y.loading}</span>
      <div className="skeleton h-12 w-12" />
      <div className="skeleton h-6 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="skeleton h-10 w-full" />
    </div>
  );
}
