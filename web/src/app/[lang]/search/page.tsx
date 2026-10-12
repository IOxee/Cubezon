import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { CATALOG_SORTS, PAGE_SIZE, searchCatalog } from "@/lib/data/catalog";
import { getShopDirectory, type ShopSummary } from "@/lib/data/shops";
import type { Format } from "@/lib/format";
import { AutoSubmitSelect } from "@/components/catalog/auto-submit-select";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { Pagination } from "@/components/catalog/pagination";
import { ProductGrid } from "@/components/catalog/product-card";
import { BlockSkeleton, ProductGridSkeleton } from "@/components/catalog/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { FILTER_FORM_ID, FilterPanel } from "./_components/filter-panel";
import { parseSearch, searchHref, toCatalogQuery, type SearchState } from "./search-state";

function pageTitle(m: Messages, state: SearchState, shop: ShopSummary | undefined): string {
  const t = m.catalog.search;
  if (state.category) return m.categories[state.category].name;
  if (state.q) return fmt(t.queryTitle, { q: state.q });
  if (shop) return fmt(t.shopTitle, { shop: shop.name });
  return t.allTitle;
}

export async function generateMetadata(props: PageProps<"/[lang]/search">): Promise<Metadata> {
  const [params, m] = await Promise.all([props.searchParams, getMessages()]);
  const state = parseSearch(params);
  if (state.category) return { title: m.categories[state.category].name };
  if (state.q) return { title: fmt(m.catalog.search.queryTitle, { q: state.q }) };
  return { title: m.catalog.search.metaTitle };
}

/** Chips of the active filters; each one links to the same search without it. */
function ActiveFilters({
  m,
  f,
  state,
  shop,
}: {
  m: Messages;
  f: Format;
  state: SearchState;
  shop: ShopSummary | undefined;
}) {
  const t = m.catalog.search.filters;
  const chips: { name: string; href: string }[] = [];
  if (state.q) chips.push({ name: `«${state.q}»`, href: searchHref(state, { q: "" }) });
  if (state.category) chips.push({ name: m.categories[state.category].name, href: searchHref(state, { category: null }) });
  if (state.shop) chips.push({ name: shop?.name ?? state.shop, href: searchHref(state, { shop: null }) });
  if (state.inStock) chips.push({ name: t.inStock, href: searchHref(state, { inStock: false }) });
  if (state.min !== null) chips.push({ name: fmt(t.priceFrom, { price: f.money(state.min) }), href: searchHref(state, { min: null }) });
  if (state.max !== null) chips.push({ name: fmt(t.priceTo, { price: f.money(state.max) }), href: searchHref(state, { max: null }) });
  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="label">{t.active}</span>
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-label={fmt(t.remove, { name: chip.name })}
          className="badge badge-paper normal-case hover:bg-paper"
        >
          {chip.name}
          <span aria-hidden className="text-ink-3">
            ×
          </span>
        </Link>
      ))}
      <Link href="/search" className="link text-xs">
        {t.clear}
      </Link>
    </div>
  );
}

function SortSelect({ m, state }: { m: Messages; state: SearchState }) {
  const t = m.catalog.search.sort;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="label whitespace-nowrap">
        {t.label}
      </label>
      <AutoSubmitSelect key={state.sort} id="sort" name="sort" form={FILTER_FORM_ID} defaultValue={state.sort} className="input w-auto py-1 text-sm">
        {CATALOG_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {t.options[sort]}
          </option>
        ))}
      </AutoSubmitSelect>
      <noscript>
        <button type="submit" form={FILTER_FORM_ID} className="btn btn-sm">
          {t.apply}
        </button>
      </noscript>
    </div>
  );
}

async function SearchResults({ searchParams }: { searchParams: PageProps<"/[lang]/search">["searchParams"] }) {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.catalog.search;
  const state = parseSearch(await searchParams);
  const [{ items, total }, shops] = await Promise.all([searchCatalog(toCatalogQuery(state)), getShopDirectory()]);
  const shop = state.shop ? shops.find((s) => s.slug === state.shop) : undefined;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (state.page - 1) * PAGE_SIZE + 1;
  const to = from + items.length - 1;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: m.catalog.breadcrumbs.home, href: "/" },
          { label: m.catalog.breadcrumbs.catalog, href: "/search" },
          ...(state.category ? [{ label: m.categories[state.category].name }] : []),
        ]}
      />
      <header className="mb-6 border-b-2 border-edge pb-3">
        <h1 className="text-2xl md:text-3xl">{pageTitle(m, state, shop)}</h1>
        {state.category ? <p className="mt-1 text-ink-2">{m.categories[state.category].blurb}</p> : null}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel m={m} state={state} shops={shops} />

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2" aria-live="polite">
              <strong className="num font-semibold text-ink">{plural(total, t.results, { count: f.integer(total) })}</strong>
              {items.length > 0 && totalPages > 1 ? (
                <span className="num ml-2 text-ink-3">
                  {fmt(t.resultsRange, { from: f.integer(from), to: f.integer(to), total: f.integer(total) })}
                </span>
              ) : null}
            </p>
            <SortSelect m={m} state={state} />
          </div>

          <ActiveFilters m={m} f={f} state={state} shop={shop} />

          {items.length > 0 ? (
            <ProductGrid items={items} layout="sidebar" />
          ) : (
            <EmptyState
              icon="spyglass"
              title={t.empty.title}
              body={t.empty.body}
              action={
                <Link href="/search" className="btn">
                  {t.empty.cta}
                </Link>
              }
            />
          )}

          <Pagination page={state.page} totalPages={totalPages} href={(page) => searchHref(state, { page })} />
        </div>
      </div>
    </>
  );
}

function SearchSkeleton() {
  return (
    <>
      <BlockSkeleton className="mb-4 h-4 w-48" />
      <BlockSkeleton className="mb-6 h-10 w-72" />
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <BlockSkeleton className="h-12 lg:h-[36rem]" />
        <div>
          <BlockSkeleton className="mb-4 h-8 w-full" />
          <ProductGridSkeleton count={8} sidebar />
        </div>
      </div>
    </>
  );
}

export default function SearchPage(props: PageProps<"/[lang]/search">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchResults searchParams={props.searchParams} />
    </Suspense>
  );
}
