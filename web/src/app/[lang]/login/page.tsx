import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fmt } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth/link-code";
import { getCurrentPlayer } from "@/lib/auth/session";
import { CommandText } from "@/components/shopping/command-text";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { SignInForm } from "./_components/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.account.signIn.metaTitle };
}

const STEP_ICONS = ["grass_block", "command_block", "tripwire_hook"] as const;

export default async function SignInPage(props: PageProps<"/[lang]/login">) {
  const m = await getMessages();
  const t = m.account.signIn;
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex flex-col gap-6">
        <header>
          <p className="label">{t.label}</p>
          <h1 className="text-2xl">{t.title}</h1>
          <p className="mt-2 max-w-prose text-ink-2">{t.intro}</p>
        </header>
        <ol className="grid gap-3 sm:grid-cols-3">
          {t.steps.map((step, index) => (
            <li key={step.title} className="card flex flex-col">
              <div className="squares relative flex aspect-[4/3] items-center justify-center">
                <ItemIcon material={STEP_ICONS[index]} size={56} />
                <span className="num absolute top-1.5 left-2 text-xs font-semibold text-ink-2">
                  {fmt(t.stepLabel, { n: index + 1 })}
                </span>
              </div>
              <div className="perforation" />
              <div className="flex flex-col gap-1 p-3">
                <h2 className="text-lg">{step.title}</h2>
                <p className="text-sm text-ink-2"><CommandText template={step.body} command={m.commands.link} /></p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sign-in-title" className="card flex flex-col gap-4 p-5">
        <h2 id="sign-in-title" className="text-xl">
          {t.formTitle}
        </h2>
        <Suspense fallback={<div role="status" aria-label={m.a11y.loading} className="skeleton h-56" />}>
          <SignInPanel searchParams={props.searchParams} />
        </Suspense>
        <p className="text-xs text-ink-3">{t.cookieNote}</p>
      </section>
    </div>
  );
}

async function SignInPanel({ searchParams }: { searchParams: PageProps<"/[lang]/login">["searchParams"] }) {
  const m = await getMessages();
  const t = m.account.signIn;
  const [{ next }, player] = await Promise.all([searchParams, getCurrentPlayer()]);
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next);

  return (
    <>
      {player ? (
        <Notice tone="success">
          <p>{fmt(t.alreadyIn, { name: player.name })}</p>
          <Link href="/account" className="link mt-1 inline-block font-semibold">
            {t.goToAccount}
          </Link>
          <p className="mt-2 text-ink-2">{t.switchAccount}</p>
        </Notice>
      ) : null}
      <SignInForm next={nextPath} />
    </>
  );
}
