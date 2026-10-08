import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { m } from "@/i18n";

const COLUMNS = [
  {
    title: m.footer.columns.buy,
    links: [
      { href: "/buscar", text: m.footer.links.catalog },
      { href: "/tiendas", text: m.footer.links.shops },
      { href: "/taquillas", text: m.footer.links.lockers },
    ],
  },
  {
    title: m.footer.columns.sell,
    links: [
      { href: "/vender", text: m.footer.links.sell },
      { href: "/panel", text: m.footer.links.panel },
      { href: "/ayuda#depositar", text: m.footer.links.deposit },
    ],
  },
  {
    title: m.footer.columns.help,
    links: [
      { href: "/ayuda", text: m.footer.links.howItWorks },
      { href: "/ayuda#vincular", text: m.footer.links.link },
      { href: "/ayuda#recoger", text: m.footer.links.pickup },
    ],
  },
  {
    title: m.footer.columns.account,
    links: [
      { href: "/cuenta", text: m.footer.links.account },
      { href: "/pedidos", text: m.footer.links.orders },
      { href: "/carrito", text: m.footer.links.cart },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-edge bg-surface">
      <a href="#top" className="block border-b border-line py-2 text-center text-sm font-semibold hover:bg-paper">
        {m.footer.backToTop}
      </a>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="label mb-3">{column.title}</h2>
            <ul className="space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:underline">
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="flex flex-col gap-1 font-mono text-xs text-ink-3">
            <p>{m.footer.legal}</p>
            <p>{m.footer.madeWith}</p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
