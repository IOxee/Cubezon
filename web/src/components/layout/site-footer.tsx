import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale/locale-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import type { Messages } from "@/i18n";
import { getMessages } from "@/i18n/server";

function columns(m: Messages) {
  return [
    {
      title: m.footer.columns.buy,
      links: [
        { href: "/search", text: m.footer.links.catalog },
        { href: "/shops", text: m.footer.links.shops },
        { href: "/lockers", text: m.footer.links.lockers },
      ],
    },
    {
      title: m.footer.columns.sell,
      links: [
        { href: "/sell", text: m.footer.links.sell },
        { href: "/panel", text: m.footer.links.panel },
        { href: "/help#deposit", text: m.footer.links.deposit },
      ],
    },
    {
      title: m.footer.columns.help,
      links: [
        { href: "/help", text: m.footer.links.howItWorks },
        { href: "/help#link", text: m.footer.links.link },
        { href: "/help#pickup", text: m.footer.links.pickup },
      ],
    },
    {
      title: m.footer.columns.account,
      links: [
        { href: "/account", text: m.footer.links.account },
        { href: "/orders", text: m.footer.links.orders },
        { href: "/cart", text: m.footer.links.cart },
      ],
    },
  ];
}

export async function SiteFooter() {
  const m = await getMessages();
  return (
    <footer className="mt-16 border-t-2 border-edge bg-surface">
      <a href="#top" className="block border-b border-line py-2 text-center text-sm font-semibold hover:bg-paper">
        {m.footer.backToTop}
      </a>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4">
        {columns(m).map((column) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
