import { m } from "@/i18n";
import { categoryFromSlug, type CategoryKey } from "@/lib/categories";
import { isCatalogSort, type CatalogQuery, type CatalogSort } from "@/lib/data/catalog";
import { isShopSlug } from "@/lib/data/shops";

/** Search page state, read from (and written back to) the URL in Spanish:
 * ?q=&categoria=<slug>&tienda=<slug>&stock=1&min=&max=&orden=&pag= */
export type SearchState = {
  q: string;
  category: CategoryKey | null;
  shop: string | null;
  inStock: boolean;
  min: number | null;
  max: number | null;
  sort: CatalogSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_QUERY = 80;
const MAX_PRICE = 1e12;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** "12,5" or "12.5" -> 12.5; anything else (or negative) -> null. */
function parsePrice(value: string): number | null {
  if (!value) return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.min(Math.round(amount * 100) / 100, MAX_PRICE);
}

export function parseSearch(params: RawParams): SearchState {
  const shop = first(params.tienda);
  const sort = first(params.orden);
  const page = Number.parseInt(first(params.pag), 10);
  let min = parsePrice(first(params.min));
  let max = parsePrice(first(params.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];

  return {
    q: first(params.q).slice(0, MAX_QUERY),
    category: categoryFromSlug(first(params.categoria) || undefined),
    shop: isShopSlug(shop) ? shop : null,
    inStock: first(params.stock) === "1",
    min,
    max,
    sort: isCatalogSort(sort) ? sort : "relevance",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

export function toCatalogQuery(state: SearchState): CatalogQuery {
  return {
    q: state.q,
    category: state.category,
    shopSlug: state.shop,
    inStock: state.inStock,
    minPrice: state.min,
    maxPrice: state.max,
    sort: state.sort,
    page: state.page,
  };
}

/** URL of the search page for a state (only non-default values). Changing a filter goes back to page 1. */
export function searchHref(state: SearchState, changes: Partial<SearchState> = {}): string {
  const next = { ...state, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("categoria", m.categories[next.category].slug);
  if (next.shop) params.set("tienda", next.shop);
  if (next.inStock) params.set("stock", "1");
  if (next.min !== null) params.set("min", String(next.min));
  if (next.max !== null) params.set("max", String(next.max));
  if (next.sort !== "relevance") params.set("orden", next.sort);
  if (next.page > 1) params.set("pag", String(next.page));
  const query = params.toString();
  return query ? `/buscar?${query}` : "/buscar";
}

/** Stable key of the filters (remounts the filter form when the URL changes). */
export function filtersKey(state: SearchState): string {
  return searchHref(state, { page: 1 });
}
