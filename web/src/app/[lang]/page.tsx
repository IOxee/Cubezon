import Link from "next/link";
import { fmt, plural, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { getActiveLockers, getBestSellers, getNewestItems } from "@/lib/data/catalog";
import { getTopShops } from "@/lib/data/shops";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { ProductGrid } from "@/components/catalog/product-card";
import { Command, RichText } from "@/components/catalog/rich-text";
import { ShopGrid } from "@/components/catalog/shop-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemIcon } from "@/components/ui/item-icon";
import { SectionHeader } from "@/components/ui/section-header";
import { Stamp } from "@/components/ui/stamp";

/** Icon and in-game command of each step of the hero (same order as m.catalog.home.hero.steps). */
function heroSteps(m: Messages): { icon: string; command: string | null }[] {
  return [
    { icon: "name_tag", command: m.commands.link },
    { icon: "chest", command: null },
    { icon: "barrel", command: m.commands.pickup },
  ];
}

function Hero({ m }: { m: Messages }) {
  const t = m.catalog.home.hero;
  const steps = heroSteps(m);
  return (
    <section className="card grid md:grid-cols-[minmax(0,7fr)_auto_minmax(0,5fr)]">
      <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
        <p className="label">{t.label}</p>
        <h1 className="text-2xl md:text-3xl">{t.title}</h1>
        <p className="max-w-prose text-md text-ink-2">{t.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href="/search" className="btn btn-primary btn-lg">
            {t.cta}
          </Link>
          <Link href="/help" className="btn btn-lg">
            {t.help}
          </Link>
          <Stamp rotate={-6} className="ml-2">
            {t.stamp}
          </Stamp>
        </div>
      </div>
      <div aria-hidden className="perforation md:hidden" />
      <div aria-hidden className="perforation-v hidden md:block" />
      <div className="bg-paper p-6 md:p-8">
        <p className="label mb-3">{t.stepsLabel}</p>
        <ol className="flex flex-col gap-3">
          {t.steps.map((step, index) => {
            const { icon, command } = steps[index];
            return (
              <li key={step.title} className="flex gap-3 border-2 border-dashed border-ink-3 bg-surface p-3">
                <span className="squares flex size-14 shrink-0 items-center justify-center border border-edge">
                  <ItemIcon material={icon} size={32} />
                </span>
                <div className="min-w-0">
                  <p className="label">{fmt(t.stepNumber, { number: String(index + 1).padStart(2, "0") })}</p>
                  <h3 className="text-lg leading-tight">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-2">
                    <RichText template={step.body} values={{ command: command ? <Command>{command}</Command> : null }} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

async function Shelves() {
  const m = await getMessages();
  const t = m.catalog.home;
  const [newest, bestSellers] = await Promise.all([getNewestItems(10), getBestSellers(10)]);

  if (newest.length === 0) {
    return (
      <EmptyState
        icon="chest"
        title={m.empty.catalog.title}
        body={m.empty.catalog.body}
        action={
          <Link href="/sell" className="btn btn-primary">
            {m.empty.catalog.cta}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <section>
        <SectionHeader label={t.newest.label} title={t.newest.title} href="/search?sort=newest" linkText={t.newest.link} />
        <ProductGrid items={newest} />
      </section>
      <section>
        <SectionHeader
          label={t.bestSelling.label}
          title={t.bestSelling.title}
          href="/search?sort=best_selling"
          linkText={t.bestSelling.link}
        />
        {bestSellers.length > 0 ? (
          <ProductGrid items={bestSellers} />
        ) : (
          <p className="card-soft px-4 py-6 text-sm text-ink-2">{t.bestSelling.empty}</p>
        )}
      </section>
    </>
  );
}

async function ShopsShelf() {
  const m = await getMessages();
  const t = m.catalog.home.shops;
  const shops = await getTopShops(6);
  return (
    <section>
      <SectionHeader label={t.label} title={t.title} href={shops.length > 0 ? "/shops" : undefined} linkText={t.link} />
      {shops.length > 0 ? (
        <ShopGrid shops={shops} />
      ) : (
        <p className="card-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-ink-2">
          {t.empty}
          <Link href="/sell" className="btn btn-sm">
            {t.cta}
          </Link>
        </p>
      )}
    </section>
  );
}

async function LockersBand() {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.home.lockers;
  const lockers = await getActiveLockers();
  const shown = lockers.slice(0, 5);
  const rest = lockers.length - shown.length;
  return (
    <section className="card grid gap-4 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className="squares flex size-16 items-center justify-center border border-edge">
        <ItemIcon material="barrel" size={40} />
      </span>
      <div className="min-w-0">
        <p className="label">{t.label}</p>
        <h2 className="text-xl">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-2">
          <strong className="font-semibold text-ink">
            {plural(lockers.length, t.count, { count: f.integer(lockers.length) })}
          </strong>
          {". "}
          {t.body}
        </p>
        {shown.length > 0 ? (
          <ul className="mt-2 flex flex-wrap items-center gap-1.5">
            {shown.map((locker) => (
              <li key={locker.id} className="badge badge-paper">
                {locker.name}
              </li>
            ))}
            {rest > 0 ? <li className="text-xs text-ink-3">{plural(rest, t.more)}</li> : null}
          </ul>
        ) : null}
      </div>
      <Link href="/lockers" className="btn justify-self-start md:justify-self-end">
        {t.link}
      </Link>
    </section>
  );
}

export default async function HomePage() {
  const m = await getMessages();
  const t = m.catalog.home;
  return (
    <div className="flex flex-col gap-12">
      <Hero m={m} />
      <section>
        <SectionHeader label={t.categories.label} title={t.categories.title} href="/search" linkText={m.nav.all} />
        <CategoryGrid />
      </section>
      <Shelves />
      <ShopsShelf />
      <LockersBand />
    </div>
  );
}
