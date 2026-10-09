import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m, plural } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { getCurrentThemeId, listThemes, type ThemeRecord } from "@/lib/data/themes";
import { formatDateTime } from "@/lib/format";
import { BASE_TOKENS, countOverrides, passesContrast, resolveTokens, type TokenSet } from "@/lib/theme/tokens";
import { activateThemeAction, deactivateThemeAction, deleteThemeAction } from "./actions";

export const metadata: Metadata = { title: m.admin.themes.title };

const t = m.admin.themes;

export default function AdminThemesPage(props: PageProps<"/admin/temas">) {
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro}>
        <Link href="/admin/temas/nuevo" className="btn btn-primary btn-sm">
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

async function ThemeList({ searchParams }: { searchParams: PageProps<"/admin/temas">["searchParams"] }) {
  await requireStaff("SUPERADMIN");
  const [themes, currentId, params] = await Promise.all([listThemes(), getCurrentThemeId(), searchParams]);
  const notice = params.aviso === "borrado" ? t.done.deleted : null;
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
          <ActionForm inline action={deactivateThemeAction}>
            <SubmitButton className="btn btn-sm">{t.base.restore}</SubmitButton>
          </ActionForm>
        ) : null}
      </article>

      {themes.length === 0 ? (
        <EmptyState icon="painting" title={t.empty.title} body={t.empty.body} />
      ) : (
        themes.map((theme) => <ThemeCard key={theme.id} theme={theme} inForce={theme.id === currentId} />)
      )}
    </div>
  );
}

function ThemeCard({ theme, inForce }: { theme: ThemeRecord; inForce: boolean }) {
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
          <Link href={`/admin/temas/${theme.id}`} className="hover:underline">
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
            ? ` · ${fmt(t.window, { start: formatDateTime(theme.startsAt), end: formatDateTime(theme.endsAt) })}`
            : ""}
          {theme.creatorName ? ` · ${fmt(t.createdBy, { name: theme.creatorName })}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/temas/${theme.id}`} className="btn btn-sm">
          {t.actions.edit}
        </Link>
        {theme.isActive ? (
          <ActionForm inline action={deactivateThemeAction}>
            <SubmitButton className="btn btn-sm">{t.actions.deactivate}</SubmitButton>
          </ActionForm>
        ) : contrastOk ? (
          <ActionForm inline action={activateThemeAction}>
            <input type="hidden" name="themeId" value={theme.id} />
            <SubmitButton className="btn btn-primary btn-sm">{t.actions.activate}</SubmitButton>
          </ActionForm>
        ) : null}
        <ActionForm inline action={deleteThemeAction} confirm={fmt(t.actions.confirmDelete, { name: theme.name })}>
          <input type="hidden" name="themeId" value={theme.id} />
          <SubmitButton className="btn btn-danger btn-sm">{t.actions.delete}</SubmitButton>
        </ActionForm>
      </div>
    </article>
  );
}
