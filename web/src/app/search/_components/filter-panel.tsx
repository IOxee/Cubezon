import Form from "next/form";
import Link from "next/link";
import { m } from "@/i18n";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { ShopSummary } from "@/lib/data/shops";
import { filtersKey, type SearchState } from "../search-state";
import { keySlug } from "@/lib/url-slug";

/** id of the filter form; the sort select of the toolbar joins it with form={FILTER_FORM_ID}. */
export const FILTER_FORM_ID = "filtros";

/**
 * Filter sidebar: a GET form, so it works without JavaScript. On small screens it folds into a
 * <details>; from lg up it is always open (the summary hides and the content stays visible).
 */
export function FilterPanel({ state, shops }: { state: SearchState; shops: ShopSummary[] }) {
  const t = m.catalog.search.filters;
  return (
    <aside>
      <details className="group card lg:[&::details-content]:[content-visibility:visible]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
          {t.toggle}
          <span aria-hidden className="font-mono text-ink-3 group-open:rotate-180">
            ▾
          </span>
        </summary>
        <Form
          id={FILTER_FORM_ID}
          key={filtersKey(state)}
          action="/search"
          className="flex flex-col gap-5 border-t border-line p-4 lg:border-t-0"
        >
          <h2 className="label hidden text-ink lg:block">{t.title}</h2>

          <div>
            <label htmlFor="filtro-q" className="label">
              {t.query}
            </label>
            <input
              id="filtro-q"
              name="q"
              type="search"
              defaultValue={state.q}
              placeholder={t.queryPlaceholder}
              maxLength={80}
              className="input mt-1"
            />
          </div>

          <fieldset>
            <legend className="label mb-1.5">{t.category}</legend>
            <ul className="flex flex-col gap-1 text-sm">
              <li>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="category" value="" defaultChecked={!state.category} className="accent-ink" />
                  {t.anyCategory}
                </label>
              </li>
              {CATEGORY_KEYS.map((key) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="category"
                      value={keySlug(key)}
                      defaultChecked={state.category === key}
                      className="accent-ink"
                    />
                    {m.categories[key].name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {shops.length > 0 ? (
            <div>
              <label htmlFor="filtro-tienda" className="label">
                {t.shop}
              </label>
              <select id="filtro-tienda" name="shop" defaultValue={state.shop ?? ""} className="input mt-1 text-sm">
                <option value="">{t.anyShop}</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.slug}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <fieldset>
            <legend className="label mb-1.5">{t.availability}</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="stock" value="1" defaultChecked={state.inStock} className="accent-ink" />
              {t.inStock}
            </label>
          </fieldset>

          <fieldset>
            <legend className="label mb-1.5">{t.price}</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filtro-min" className="text-xs text-ink-3">
                  {t.min}
                </label>
                <input
                  id="filtro-min"
                  name="min"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  defaultValue={state.min ?? ""}
                  className="input num text-sm"
                />
              </div>
              <div>
                <label htmlFor="filtro-max" className="text-xs text-ink-3">
                  {t.max}
                </label>
                <input
                  id="filtro-max"
                  name="max"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  defaultValue={state.max ?? ""}
                  className="input num text-sm"
                />
              </div>
            </div>
          </fieldset>

          <div className="flex flex-col items-center gap-2">
            <button type="submit" className="btn btn-ink btn-block">
              {t.apply}
            </button>
            <Link href="/search" className="link text-sm">
              {t.clear}
            </Link>
          </div>
        </Form>
      </details>
    </aside>
  );
}
