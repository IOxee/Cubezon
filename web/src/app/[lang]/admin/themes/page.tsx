import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, plural, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { getCurrentThemeId, listThemes, type ThemeRecord } from "@/lib/data/themes";
import type { Format } from "@/lib/format";
import { BASE_TOKENS, countOverrides, passesContrast, resolveTokens, type TokenSet } from "@/lib/theme/tokens";
import { activateThemeAction, deactivateThemeAction, deleteThemeAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.admin.themes.title };
}

export default async function AdminThemesPage(props: PageProps<"/[lang]/admin/themes">) {
  const t = (await getMessages()).admin.themes;
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro}>
        <Link href="/admin/themes/new" className="btn btn-primary btn-sm">
          {t.newTheme}
        </Link>
      </AdminPageHeader>
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <ThemeList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

/** Paper, surface, ink and accent of one mode, as small squares. */
function Swatches({ set }: { set: TokenSet }) {
  return (
    <span className="inline-flex border border-edge" aria-hidden="true">
      {[set.paper, set.surface, set.ink, set.accent].map((color, i) => (
        <span key={i} className="size-4" style={{ background: color }} />
      ))}
    </span>
  );
}

async function ThemeList({ searchParams }: { searchParams: PageProps<"/[lang]/admin/themes">["searchParams"] }) {
  await requireStaff("SUPERADMIN");
  const [themes, currentId, params, m, f] = await Promise.all([
    listThemes(),
    getCurrentThemeId(),
    searchParams,
    getMessages(),
    getFormat(),
  ]);
  const t = m.admin.themes;
  const notice = params.notice === "deleted" ? t.done.deleted : null;
  const manualActive = themes.some((theme) => theme.isActive);

  return (
    <div className="grid gap-3">
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <article className="card-soft flex flex-wrap items-center gap-4 p-4">
        <div className="flex gap-1">
          <Swatches set={BASE_TOKENS.light} />
          <Swatches set={BASE_TOKENS.dark} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg">
            {t.base.name}
            {currentId === null ? <span className="badge badge-accent">{t.badges.inForce}</span> : null}
          </h2>
          <p className="text-sm text-ink-2">{t.base.description}</p>
        </div>
        {manualActive ? (
          <ActionForm action={deactivateThemeAction}>
            <SubmitButton className="btn btn-sm">{t.base.restore}</SubmitButton>
          </ActionForm>
        ) : null}
      </article>

      {themes.length === 0 ? (
        <EmptyState icon="painting" title={t.empty.title} body={t.empty.body} />
      ) : (
        themes.map((theme) => <ThemeCard key={theme.id} theme={theme} inForce={theme.id === currentId} m={m} f={f} />)
      )}
    </div>
  );
}

function ThemeCard({ theme, inForce, m, f }: { theme: ThemeRecord; inForce: boolean; m: Messages; f: Format }) {
  const t = m.admin.themes;
  const contrastOk = passesContrast(theme.tokens);
  const phase = theme.phase;

  return (
    <article className="card-soft flex flex-wrap items-center gap-4 p-4">
      <div className="flex gap-1">
        <Swatches set={resolveTokens(theme.tokens, "light")} />
        <Swatches set={resolveTokens(theme.tokens, "dark")} />
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <h2 className="flex flex-wrap items-center gap-2 text-lg">
          <Link href={`/admin/themes/${theme.id}`} className="hover:underline">
            {theme.name}
          </Link>
          {inForce ? <span className="badge badge-accent">{t.badges.inForce}</span> : null}
          {theme.isActive ? <span className="badge badge-ink">{t.badges.manual}</span> : null}
          {phase ? <span className="badge badge-paper">{t.badges[phase]}</span> : null}
          <span className={`badge ${contrastOk ? "badge-paper" : "badge-paper text-danger"}`}>
            {contrastOk ? t.badges.contrastOk : t.badges.contrastFail}
          </span>
        </h2>
        <p className="text-xs text-ink-3">
          {plural(countOverrides(theme.tokens), t.overrides)}
          {theme.startsAt && theme.endsAt
            ? ` · ${fmt(t.window, { start: f.dateTime(theme.startsAt), end: f.dateTime(theme.endsAt) })}`
            : ""}
          {theme.creatorName ? ` · ${fmt(t.createdBy, { name: theme.creatorName })}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/themes/${theme.id}`} className="btn btn-sm">
          {t.actions.edit}
        </Link>
        {theme.isActive ? (
          <ActionForm action={deactivateThemeAction}>
            <SubmitButton className="btn btn-sm">{t.actions.deactivate}</SubmitButton>
          </ActionForm>
        ) : contrastOk ? (
          <ActionForm action={activateThemeAction}>
            <input type="hidden" name="themeId" value={theme.id} />
            <SubmitButton className="btn btn-primary btn-sm">{t.actions.activate}</SubmitButton>
          </ActionForm>
        ) : null}
        <ActionForm action={deleteThemeAction} confirm={fmt(t.actions.confirmDelete, { name: theme.name })}>
          <input type="hidden" name="themeId" value={theme.id} />
          <SubmitButton className="btn btn-danger btn-sm">{t.actions.delete}</SubmitButton>
        </ActionForm>
      </div>
    </article>
  );
}
