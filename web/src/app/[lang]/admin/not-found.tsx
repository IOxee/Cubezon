import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { getMessages } from "@/i18n/server";

/** Unknown order or record inside the admin area (only staff get this far). */
export default async function AdminNotFound() {
  const m = await getMessages();
  return (
    <EmptyState
      icon="compass"
      title={m.admin.notFound.title}
      body={m.admin.notFound.body}
      action={
        <Link href="/admin" className="btn btn-sm">
          {m.admin.notFound.back}
        </Link>
      }
    />
  );
}
