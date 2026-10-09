import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable, td, th } from "@/components/admin/data-table";
import { fill } from "@/components/admin/fill";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { listLockers } from "@/lib/data/admin";
import { formatDate, formatInteger } from "@/lib/format";
import { setLockerActiveAction } from "./actions";

export const metadata: Metadata = { title: m.admin.lockers.title };

const t = m.admin.lockers;

function worldName(world: string): string {
  return (m.worlds as Record<string, string>)[world] ?? world;
}

export default function AdminLockersPage() {
  return (
    <>
      <AdminPageHeader
        title={t.title}
        intro={fill(t.howTo, {
          create: <span className="cmd">{m.commands.lockerCreate}</span>,
          remove: <span className="cmd">{t.removeCommand}</span>,
        })}
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <LockersTable />
      </Suspense>
    </>
  );
}

async function LockersTable() {
  await requireStaff();
  const lockers = await listLockers();

  if (lockers.length === 0) {
    return (
      <EmptyState
        icon="barrel"
        title={t.empty.title}
        body={fill(t.empty.body, { command: <span className="cmd">{m.commands.lockerCreate}</span> })}
      />
    );
  }

  return (
    <>
      <DataTable caption={t.title}>
        <thead>
          <tr>
            <th scope="col" className={th}>{t.columns.name}</th>
            <th scope="col" className={th}>{t.columns.world}</th>
            <th scope="col" className={th}>{t.columns.coords}</th>
            <th scope="col" className={`${th} text-right`}>{t.columns.open}</th>
            <th scope="col" className={th}>{t.columns.created}</th>
            <th scope="col" className={th}>{t.columns.status}</th>
            <th scope="col" className={th}>{t.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {lockers.map((locker) => (
            <tr key={locker.id} className={locker.active ? undefined : "text-ink-2"}>
              <td className={`${td} font-semibold`}>{locker.name}</td>
              <td className={td}>{worldName(locker.world)}</td>
              <td className={`${td} num whitespace-nowrap`}>
                {fmt(t.coordsValue, { x: locker.x, y: locker.y, z: locker.z })}
              </td>
              <td className={`${td} num text-right`}>{formatInteger(locker.openOrders)}</td>
              <td className={`${td} num whitespace-nowrap`}>{formatDate(locker.createdAt)}</td>
              <td className={td}>
                <span className={`badge ${locker.active ? "badge-ink" : "badge-paper"}`}>
                  {locker.active ? t.active : t.inactive}
                </span>
              </td>
              <td className={td}>
                <ActionForm action={setLockerActiveAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="lockerId" value={locker.id} />
                  <input type="hidden" name="active" value={locker.active ? "false" : "true"} />
                  <SubmitButton className={`btn btn-sm ${locker.active ? "btn-danger" : ""}`} pendingLabel={t.saving}>
                    {locker.active ? t.deactivate : t.activate}
                  </SubmitButton>
                </ActionForm>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <p className="mt-3 text-sm text-ink-2">{t.inactiveHint}</p>
    </>
  );
}
