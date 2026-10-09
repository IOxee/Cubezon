import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { saveThemeAction } from "../actions";
import { ThemeEditor } from "../_components/theme-editor";

export const metadata: Metadata = { title: m.admin.themes.newTitle };

const t = m.admin.themes;

export default function NewThemePage() {
  return (
    <>
      <AdminPageHeader title={t.newTitle} intro={t.intro}>
        <Link href="/admin/temas" className="link text-sm">
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
