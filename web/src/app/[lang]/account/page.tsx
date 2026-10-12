import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural, type Messages } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { requirePlayer } from "@/lib/auth/session";
import { getAccountOverview } from "@/lib/data/orders";
import { CommandText } from "@/components/shopping/command-text";
import { ItemIcon } from "@/components/ui/item-icon";
import { PlayerHead } from "@/components/ui/player-head";
import { Stamp } from "@/components/ui/stamp";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOutAction, signOutEverywhereAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.account.account.metaTitle };
}

export default async function AccountPage() {
  const m = await getMessages();
  return (
    <Suspense fallback={<AccountSkeleton m={m} />}>
      <Account />
    </Suspense>
  );
}

function Shortcut({ href, icon, title, body }: { href: string; icon: string; title: string; body: string }) {
  return (
    <li>
      <Link href={href} className="lift card flex h-full items-start gap-3 p-4">
        <span className="squares shrink-0 border border-line p-1.5">
          <ItemIcon material={icon} size={32} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-ink-2">{body}</span>
        </span>
      </Link>
    </li>
  );
}

const SHOP_STATUS_ORDER = ["APPROVED", "PENDING", "REJECTED", "SUSPENDED"] as const;

/** Shop counts by status plus employee shops, e.g. "2 shops (1 approved, 1 in review). Products, stock and sales of each." */
function shopsSummary(
  m: Messages,
  statuses: readonly (typeof SHOP_STATUS_ORDER)[number][], employeeShops: number,
): string {
  const t = m.account.account.shops;
  const parts = SHOP_STATUS_ORDER.map((status) => [status, statuses.filter((value) => value === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => plural(count, t.status[status]));
  const owned =
    statuses.length > 0 ? fmt(t.summary, { count: plural(statuses.length, t.count), statuses: parts.join(", ") }) : "";
  const employee = employeeShops > 0 ? plural(employeeShops, t.employee) : "";
  return [owned, employee, t.body].filter(Boolean).join(" ");
}

async function Account() {
  const m = await getMessages();
  const t = m.account.account;
  const player = await requirePlayer("/account");
  const overview = await getAccountOverview(player);

  const ordersBody = [
    plural(overview.activeOrders, t.ordersActive),
    overview.readyOrders > 0 ? plural(overview.readyOrders, t.ordersReady) : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-edge pb-4">
        <div className="flex items-center gap-4">
          <span className="squares border-2 border-edge p-2">
            <PlayerHead uuid={player.uuid} size={56} alt={fmt(m.a11y.avatar, { name: player.name })} />
          </span>
          <div>
            <p className="label">{t.label}</p>
            <h1 className="text-2xl">{fmt(t.title, { name: player.name })}</h1>
          </div>
        </div>
        {player.role ? (
          <Stamp tone="ink" size="md" rotate={-4}>
            {m.status.staff[player.role]}
          </Stamp>
        ) : null}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="shortcuts-title" className="flex flex-col gap-3">
          <h2 id="shortcuts-title" className="label">
            {t.shortcuts}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Shortcut href="/orders" icon="chest" title={t.orders.title} body={`${t.orders.body} ${ordersBody}`} />
            <Shortcut href="/cart" icon="bundle" title={t.cart.title} body={t.cart.body} />
            {overview.shopStatuses.length > 0 || overview.employeeShops > 0 ? (
              <Shortcut
                href="/panel"
                icon="barrel"
                title={t.shops.title}
                body={shopsSummary(m, overview.shopStatuses, overview.employeeShops)}
              />
            ) : (
              <Shortcut href="/sell" icon="emerald" title={t.sell.title} body={t.sell.body} />
            )}
            {player.role ? <Shortcut href="/admin" icon="command_block" title={t.admin.title} body={t.admin.body} /> : null}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="player-title" className="card p-4">
            <h2 id="player-title" className="label mb-3">
              {t.player}
            </h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="label">{t.player}</dt>
                <dd className="font-semibold">{player.name}</dd>
              </div>
              <div>
                <dt className="label">{t.uuid}</dt>
                <dd className="num text-xs break-all">{player.uuid}</dd>
              </div>
              {player.role ? (
                <div>
                  <dt className="label">{t.role}</dt>
                  <dd>{m.status.staff[player.role]}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-xs text-ink-3">
              <CommandText template={t.linkedWith} command={m.commands.link} />
            </p>
          </section>

          <section aria-labelledby="session-title" className="card flex flex-col gap-3 p-4">
            <h2 id="session-title" className="label">
              {t.sessionTitle}
            </h2>
            <p className="text-sm text-ink-2">{t.sessionBody}</p>
            <form action={signOutAction}>
              <SubmitButton className="btn btn-block" pendingLabel={t.signingOut}>
                {t.signOut}
              </SubmitButton>
            </form>
            <form action={signOutEverywhereAction} className="flex flex-col gap-1">
              <SubmitButton className="btn btn-danger btn-block whitespace-normal" pendingLabel={t.signingOut}>
                {t.signOutEverywhere}
              </SubmitButton>
              <p className="text-xs text-ink-3">{t.signOutEverywhereHint}</p>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AccountSkeleton({ m }: { m: Messages }) {
  return (
    <div role="status" aria-label={m.a11y.loading} className="flex flex-col gap-8">
      <div className="skeleton h-20" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
