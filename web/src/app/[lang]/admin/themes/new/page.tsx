import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { saveThemeAction } from "../actions";
import { ThemeEditor } from "../_components/theme-editor";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.admin.themes.newTitle };
}

export default async function NewThemePage() {
  const t = (await getMessages()).admin.themes;
  return (
    <>
      <AdminPageHeader title={t.newTitle} intro={t.intro}>
        <Link href="/admin/themes" className="link text-sm">
          {t.back}
        </Link>
      </AdminPageHeader>
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <NewThemeForm />
      </Suspense>
    </>
  );
}

async function NewThemeForm() {
  await requireStaff("SUPERADMIN");
  return (
    <ThemeEditor
      action={saveThemeAction.bind(null, null)}
      initial={{ name: "", tokens: { light: {}, dark: {} }, startsAt: null, endsAt: null }}
    />
  );
}
