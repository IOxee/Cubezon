import type { Metadata } from "next";
import Link from "next/link";
import { fmt, m, plural } from "@/i18n";
import { getActiveLockers } from "@/lib/data/catalog";
import { formatInteger } from "@/lib/format";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { Command, RichText } from "@/components/catalog/rich-text";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemIcon } from "@/components/ui/item-icon";

export const metadata: Metadata = {
  title: m.catalog.lockers.title,
  description: m.catalog.lockers.lead,
};

function worldName(world: string): string {
  return (m.worlds as Record<string, string>)[world] ?? world;
}

function HowToCollect() {
  const t = m.catalog.lockers;
  return (
    <aside className="ticket ticket-shadow self-start">
      <h2 className="label mb-3 text-ink">{t.howTitle}</h2>
      <ol className="flex flex-col gap-2">
        {t.howSteps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="num shrink-0 font-semibold">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <RichText template={step} values={{ command: <Command>{m.commands.pickup}</Command> }} />
            </span>
          </li>
        ))}
      </ol>
      <div className="ticket-rule my-3" />
      <ul className="flex flex-col gap-1">
        <li>
          <Link href="/pedidos" className="link">
            {t.ordersLink}
          </Link>
        </li>
        <li>
          <Link href="/ayuda#recoger" className="link">
            {t.helpLink}
          </Link>
        </li>
      </ul>
    </aside>
  );
}

export default async function LockersPage() {
  const t = m.catalog.lockers;
  const lockers = await getActiveLockers();
  return (
    <>
      <Breadcrumbs items={[{ label: m.catalog.breadcrumbs.home, href: "/" }, { label: t.title }]} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-edge pb-3">
        <div>
          <h1 className="text-2xl md:text-3xl">{t.title}</h1>
          <p className="mt-1 max-w-prose text-ink-2">{t.lead}</p>
        </div>
        <p className="num text-sm text-ink-3">{plural(lockers.length, t.count, { count: formatInteger(lockers.length) })}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {lockers.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lockers.map((locker) => (
              <li key={locker.id} className="card flex gap-3 p-4">
                <span className="squares flex size-14 shrink-0 items-center justify-center border border-edge">
                  <ItemIcon material="barrel" size={32} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg leading-tight">{locker.name}</h2>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="label self-center">{t.world}</dt>
                    <dd>{worldName(locker.world)}</dd>
                    <dt className="label self-center">{t.coords}</dt>
                    <dd className="num">{fmt(t.coordsValue, { x: locker.x, y: locker.y, z: locker.z })}</dd>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="barrel" title={t.empty.title} body={t.empty.body} />
        )}
        <HowToCollect />
      </div>
    </>
  );
}
