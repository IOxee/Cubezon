import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt, m } from "@/i18n";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { Command, RichText } from "@/components/catalog/rich-text";
import { ItemIcon } from "@/components/ui/item-icon";
import { getOrdersMode } from "@/lib/data/roleplay";

export const metadata: Metadata = {
  title: m.help.meta.title,
  description: m.help.meta.description,
};

type SectionId = keyof typeof m.help.sections;

/** Section order (the keys are the #anchors linked from the footer and other pages). */
const SECTIONS: { id: SectionId; icon: string; command: string | null }[] = [
  { id: "vincular", icon: "name_tag", command: m.commands.link },
  { id: "comprar", icon: "chest", command: null },
  { id: "recoger", icon: "barrel", command: m.commands.pickup },
  { id: "vender", icon: "oak_sign", command: null },
  { id: "depositar", icon: "hopper", command: m.commands.deposit },
];

function placeholders(command: string | null) {
  const links = m.help.links;
  return {
    command: command ? <Command>{command}</Command> : null,
    signIn: (
      <Link href="/entrar" className="link font-semibold">
        {links.signIn}
      </Link>
    ),
    lockers: (
      <Link href="/taquillas" className="link font-semibold">
        {links.lockers}
      </Link>
    ),
    orders: (
      <Link href="/pedidos" className="link font-semibold">
        {links.orders}
      </Link>
    ),
    sell: (
      <Link href="/vender" className="link font-semibold">
        {links.sell}
      </Link>
    ),
    panel: (
      <Link href="/panel" className="link font-semibold">
        {links.panel}
      </Link>
    ),
  };
}

function HelpSection({ id, icon, command }: (typeof SECTIONS)[number]) {
  const section = m.help.sections[id];
  const values = placeholders(command);
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="card scroll-mt-4">
      <div className="flex items-center gap-3 border-b-2 border-edge p-4">
        <span className="squares flex size-12 shrink-0 items-center justify-center border border-edge">
          <ItemIcon material={icon} size={32} />
        </span>
        <div>
          <p className="label">{section.label}</p>
          <h2 id={`${id}-titulo`} className="text-xl">
            {section.title}
          </h2>
        </div>
      </div>
      <ol className="flex flex-col gap-3 p-4">
        {section.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center border border-edge bg-paper font-mono text-sm font-semibold">
              <span className="sr-only">{fmt(m.help.stepLabel, { number: index + 1 })}</span>
              <span aria-hidden>{index + 1}</span>
            </span>
            <p className="pt-0.5">
              <RichText template={step} values={values} />
            </p>
          </li>
        ))}
      </ol>
      <div className="perforation" />
      <p className="bg-paper px-4 py-3 text-sm text-ink-2">
        <RichText template={section.note} values={values} />
      </p>
    </section>
  );
}

const ROLEPLAY_ID = "roleplay";

/** Order mode the plugin runs now (cached, refreshed every minute). */
async function CurrentMode() {
  const mode = await getOrdersMode();
  return (
    <p className="flex items-center gap-2 text-sm">
      <span className="label">{m.help.roleplay.current}</span>
      <span className="badge badge-ink">{m.roleplay.modes[mode]}</span>
    </p>
  );
}

/** Roleplay order mode: how an order goes and the commands for shops. */
function RoleplaySection() {
  const t = m.help.roleplay;
  return (
    <section id={ROLEPLAY_ID} aria-labelledby={`${ROLEPLAY_ID}-titulo`} className="card scroll-mt-4">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-edge p-4">
        <span className="squares flex size-12 shrink-0 items-center justify-center border border-edge">
          <ItemIcon material="paper" size={32} />
        </span>
        <div className="mr-auto">
          <p className="label">{t.label}</p>
          <h2 id={`${ROLEPLAY_ID}-titulo`} className="text-xl">
            {t.title}
          </h2>
        </div>
        <Suspense fallback={null}>
          <CurrentMode />
        </Suspense>
      </div>
      <p className="px-4 pt-4 text-ink-2">{t.lead}</p>
      <ol className="flex flex-col gap-3 p-4">
        {t.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center border border-edge bg-paper font-mono text-sm font-semibold">
              <span className="sr-only">{fmt(m.help.stepLabel, { number: index + 1 })}</span>
              <span aria-hidden>{index + 1}</span>
            </span>
            <p className="pt-0.5">{step}</p>
          </li>
        ))}
      </ol>
      <div className="perforation" />
      <div className="bg-paper px-4 py-3 text-sm">
        <h3 className="label mb-2 text-ink">{t.commandsTitle}</h3>
        <dl className="flex flex-col gap-2">
          {t.commands.map((item) => (
            <div key={item.key} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="shrink-0">
                <Command>{m.roleplay.commands[item.key]}</Command>
              </dt>
              <dd className="text-ink-2">{item.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-ink-2">
          <RichText template={t.note} values={placeholders(null)} />
        </p>
      </div>
    </section>
  );
}

export default function HelpPage() {
  const t = m.help;
  return (
    <>
      <Breadcrumbs items={[{ label: m.catalog.breadcrumbs.home, href: "/" }, { label: t.meta.title }]} />
      <header className="mb-8 border-b-2 border-edge pb-4">
        <h1 className="text-2xl md:text-3xl">{t.title}</h1>
        <p className="mt-2 max-w-prose text-md text-ink-2">{t.lead}</p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t.tocLabel} className="card-soft p-4 lg:sticky lg:top-4">
          <p className="label mb-2">{t.tocLabel}</p>
          <ol className="flex flex-col gap-1.5 text-sm">
            {SECTIONS.map(({ id }) => (
              <li key={id}>
                <a href={`#${id}`} className="link">
                  {t.sections[id].title}
                </a>
              </li>
            ))}
            <li>
              <a href={`#${ROLEPLAY_ID}`} className="link">
                {t.roleplay.title}
              </a>
            </li>
            <li>
              <a href="#preguntas" className="link">
                {t.faq.label}
              </a>
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <HelpSection key={section.id} {...section} />
          ))}
          <RoleplaySection />

          <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-4">
            <div className="mb-4 border-b-2 border-edge pb-2">
              <p className="label">{t.faq.label}</p>
              <h2 id="preguntas-titulo" className="text-xl">
                {t.faq.title}
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {t.faq.items.map((item) => (
                <details key={item.q} className="group card-soft">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="font-mono text-ink-3 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="border-t border-line px-4 py-3 text-ink-2">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <aside className="ticket ticket-shadow">
            <h2 className="label mb-1 text-ink">{t.contact.title}</h2>
            <p>{t.contact.body}</p>
          </aside>
        </div>
      </div>
    </>
  );
}
