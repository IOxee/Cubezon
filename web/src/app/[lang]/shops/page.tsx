import type { Metadata } from "next";
import Link from "next/link";
import { plural } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { getShopDirectory } from "@/lib/data/shops";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { ShopGrid } from "@/components/catalog/shop-card";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return {
    title: m.catalog.shops.title,
    description: m.catalog.shops.lead,
  };
}

export default async function ShopsPage() {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.shops;
  const shops = await getShopDirectory();
  return (
    <>
      <Breadcrumbs items={[{ label: m.catalog.breadcrumbs.home, href: "/" }, { label: m.catalog.breadcrumbs.shops }]} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-edge pb-3">
        <div>
          <h1 className="text-2xl md:text-3xl">{t.title}</h1>
          <p className="mt-1 max-w-prose text-ink-2">{t.lead}</p>
        </div>
        <p className="num text-sm text-ink-3">{plural(shops.length, t.count, { count: f.integer(shops.length) })}</p>
      </header>
      {shops.length > 0 ? (
        <ShopGrid shops={shops} />
      ) : (
        <EmptyState
          icon="oak_sign"
          title={t.empty.title}
          body={t.empty.body}
          action={
            <Link href="/sell" className="btn btn-primary">
              {t.empty.cta}
            </Link>
          }
        />
      )}
    </>
  );
}
