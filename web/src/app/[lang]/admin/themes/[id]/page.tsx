import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/catalog";
import { getTheme } from "@/lib/data/themes";
import { passesContrast } from "@/lib/theme/tokens";
import { activateThemeAction, deactivateThemeAction, deleteThemeAction, saveThemeAction } from "../actions";
import { ThemeEditor } from "../_components/theme-editor";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.admin.themes.title };
}

export default function EditThemePage(props: PageProps<"/[lang]/admin/themes/[id]">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <EditTheme params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EditTheme({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/admin/themes/[id]">["params"];
  searchParams: PageProps<"/[lang]/admin/themes/[id]">["searchParams"];
}) {
  await requireStaff("SUPERADMIN");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const theme = await getTheme(id);
  if (!theme) notFound();
  const t = (await getMessages()).admin.themes;

  return (
    <>
      <AdminPageHeader title={fmt(t.editTitle, { name: theme.name })} intro={t.intro}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/themes" className="link text-sm">
            {t.back}
          </Link>
          {theme.isActive ? (
            <ActionForm action={deactivateThemeAction}>
              <SubmitButton className="btn btn-sm">{t.actions.deactivate}</SubmitButton>
            </ActionForm>
          ) : passesContrast(theme.tokens) ? (
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
      </AdminPageHeader>

      {query.notice === "created" ? (
        <Notice tone="success" className="mb-4">
          {t.done.created}
        </Notice>
      ) : null}

      <ThemeEditor
        action={saveThemeAction.bind(null, theme.id)}
        initial={{ name: theme.name, tokens: theme.tokens, startsAt: theme.startsAt, endsAt: theme.endsAt }}
      />
    </>
  );
}
