import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { fmt, m, plural } from "@/i18n";
import { getCurrentPlayer } from "@/lib/auth/session";
import { CART_COOKIE, cartUnits, parseCart } from "@/lib/cart";
import { CATEGORY_ICON, CATEGORY_KEYS } from "@/lib/categories";
import { signOutAction } from "@/app/cuenta/actions";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Dropdown } from "@/components/ui/dropdown";
import { dropdownItem } from "@/components/ui/dropdown-item";
import { ItemIcon } from "@/components/ui/item-icon";

export function Logo() {
  return (
    <Link href="/" aria-label={m.header.home} className="flex shrink-0 items-center gap-2">
      <span aria-hidden className="notch relative size-7 bg-accent shadow-[inset_0_0_0_2px_var(--edge)]">
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[color-mix(in_srgb,var(--edge)_35%,transparent)]" />
      </span>
      {/* Weight 500: at 700 Pixelify's "C" closes up and reads as an "O". */}
      <span className="font-pixel text-2xl leading-none font-medium tracking-wide">{m.meta.siteName}</span>
    </Link>
  );
}

function SearchForm() {
  return (
    <form action="/buscar" role="search" className="flex min-w-0 flex-1">
      <label className="sr-only" htmlFor="header-scope">
        {m.header.search.scope}
      </label>
      <select id="header-scope" name="categoria" defaultValue="" className="input w-auto max-w-36 border-r-0 text-sm">
        <option value="">{m.header.search.allCategories}</option>
        {CATEGORY_KEYS.map((key) => (
          <option key={key} value={m.categories[key].slug}>
            {m.categories[key].name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="header-q">
        {m.header.search.label}
      </label>
      <input
        id="header-q"
        name="q"
        type="search"
        placeholder={m.header.search.placeholder}
        className="input min-w-0 flex-1"
        maxLength={80}
      />
      <button type="submit" className="btn btn-primary shrink-0">
        {m.header.search.submit}
      </button>
    </form>
  );
}

/** "Mi cuenta" with a menu of the other account sections (orders have their own button). */
function AccountMenu({ name, role }: { name: string; role: string | null }) {
  const t = m.header.account.menu;
  return (
    <Dropdown
      align="end"
      label={m.header.account.menuLabel}
      summaryClassName="btn btn-ghost gap-2"
      summary={
        <span className="flex flex-col items-start leading-tight">
          <span className="text-xs text-ink-3">{fmt(m.header.account.hello, { name })}</span>
          <span className="font-semibold">{m.header.account.myAccount}</span>
        </span>
      }
    >
      <Link href="/cuenta" className={dropdownItem}>
        {t.account}
      </Link>
      <Link href="/panel" className={dropdownItem}>
        {t.shops}
      </Link>
      <Link href="/vender" className={dropdownItem}>
        {t.sell}
      </Link>
      {role ? (
        <Link href="/admin" className={dropdownItem}>
          {t.admin}
        </Link>
      ) : null}
      <Link href="/ayuda" className={dropdownItem}>
        {t.help}
      </Link>
      <div className="my-1 border-t border-line" />
      <form action={signOutAction}>
        <button type="submit" className={`${dropdownItem} text-danger`}>
          {t.signOut}
        </button>
      </form>
    </Dropdown>
  );
}

function AccountLinks({ name, units, role }: { name: string | null; units: number; role: string | null }) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {name ? (
        <AccountMenu name={name} role={role} />
      ) : (
        <Link href="/entrar" className="btn btn-ghost flex-col items-start gap-0 leading-tight">
          <span className="text-xs text-ink-3">{m.header.account.signInHint}</span>
          <span className="font-semibold">{m.header.account.signIn}</span>
        </Link>
      )}
      <Link href="/pedidos" className="btn btn-ghost hidden flex-col items-start gap-0 leading-tight sm:flex">
        <span className="text-xs text-ink-3">{m.header.ordersHint}</span>
        <span className="font-semibold">{m.header.orders}</span>
      </Link>
      <Link href="/carrito" className="btn btn-ghost font-semibold" aria-label={plural(units, m.header.cartCount)}>
        {m.header.cart}
        <span className="badge badge-accent num">{units}</span>
      </Link>
    </nav>
  );
}

async function HeaderAccount() {
  const [player, store] = await Promise.all([getCurrentPlayer(), cookies()]);
  const units = cartUnits(parseCart(store.get(CART_COOKIE)?.value));
  return <AccountLinks name={player?.name ?? null} units={units} role={player?.role ?? null} />;
}

export function SiteHeader() {
  return (
    <header className="border-b-2 border-edge bg-surface">
      <div className="hidden bg-ink text-paper sm:block">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-1">
          <p className="flex min-w-0 flex-1 gap-6 overflow-hidden font-mono text-xs whitespace-nowrap">
            <span>{m.header.topbar[0]}</span>
            <span>{m.header.topbar[1]}</span>
            <span>{fmt(m.header.topbar[2], { command: m.commands.link })}</span>
          </p>
          <ThemeSwitcher compact inverted />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Logo />
        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <SearchForm />
        </div>
        <div className="ml-auto md:ml-0">
          <Suspense fallback={<AccountLinks name={null} units={0} role={null} />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 gap-y-1 px-3 py-1 text-sm whitespace-nowrap">
          {/* Catalog: what you can buy. Wraps instead of scrolling; the full list is in the menu. */}
          <nav aria-label={m.a11y.categoriesNav}>
            <ul className="flex flex-wrap items-center gap-1">
              <li>
                <Dropdown
                  summary={m.header.categories}
                  summaryClassName="btn btn-ghost btn-sm gap-2 font-semibold"
                  label={m.header.categoriesLabel}
                >
                  <ul className="grid gap-0.5 sm:w-96 sm:grid-cols-2">
                    {CATEGORY_KEYS.map((key) => (
                      <li key={key}>
                        <Link href={`/buscar?categoria=${m.categories[key].slug}`} className={dropdownItem}>
                          <ItemIcon material={CATEGORY_ICON[key]} size={20} />
                          {m.categories[key].name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Dropdown>
              </li>
              <li>
                <Link href="/buscar" className="btn btn-ghost btn-sm font-semibold">
                  {m.nav.all}
                </Link>
              </li>
              {CATEGORY_KEYS.slice(0, 5).map((key) => (
                <li key={key} className="hidden xl:block">
                  <Link href={`/buscar?categoria=${m.categories[key].slug}`} className="btn btn-ghost btn-sm">
                    {m.categories[key].name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* The rest of the site: places and help, set apart from the catalog. */}
          <nav aria-label={m.a11y.siteNav} className="ml-auto flex items-center gap-1 border-l-2 border-line pl-3">
            <Link href="/tiendas" className="btn btn-ghost btn-sm gap-1.5">
              <ItemIcon material="barrel" size={16} />
              {m.nav.shops}
            </Link>
            <Link href="/taquillas" className="btn btn-ghost btn-sm gap-1.5">
              <ItemIcon material="chest" size={16} />
              {m.nav.lockers}
            </Link>
            <Link href="/ayuda" className="btn btn-ghost btn-sm gap-1.5">
              <ItemIcon material="book" size={16} />
              {m.nav.help}
            </Link>
            <Link href="/vender" className="btn btn-sm ml-1 font-semibold">
              {m.nav.sell}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
