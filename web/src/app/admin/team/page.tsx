import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable, td, th } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m } from "@/i18n";
import { requireStaff, type Player } from "@/lib/auth/session";
import { STAFF_ROLES, listStaff } from "@/lib/data/admin";
import { formatDate } from "@/lib/format";
import { addStaffAction, removeStaffAction, setStaffRoleAction } from "./actions";

export const metadata: Metadata = { title: m.admin.team.title };

const t = m.admin.team;

/** Superadmin only: even the title waits for the role check, so admins just get a 404. */
export default function AdminTeamPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <Team />
    </Suspense>
  );
}

function AddMemberForm() {
  return (
    <section className="card-soft mb-5 p-4">
      <h2 className="mb-3 text-lg">{t.add.title}</h2>
      <ActionForm action={addStaffAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="staff-name" className="label">
            {t.add.name}
          </label>
          <input
            id="staff-name"
            name="name"
            required
            maxLength={16}
            pattern="[A-Za-z0-9_]{1,16}"
            autoComplete="off"
            spellCheck={false}
            placeholder={t.add.placeholder}
            aria-describedby="staff-name-hint"
            className="input mt-1 num"
          />
        </div>
        <div>
          <label htmlFor="staff-role" className="label">
            {t.add.role}
          </label>
          <select id="staff-role" name="role" defaultValue="ADMIN" className="input mt-1">
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {m.status.staff[role]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton className="btn btn-primary" pendingLabel={t.saving}>
          {t.add.submit}
        </SubmitButton>
        <p id="staff-name-hint" className="basis-full text-xs text-ink-3">
          {t.add.hint}
        </p>
      </ActionForm>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-line pt-3 text-sm">
        {STAFF_ROLES.map((role) => (
          <div key={role} className="contents">
            <dt className="font-semibold">{m.status.staff[role]}</dt>
            <dd className="text-ink-2">{t.roles[role]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function Team() {
  const me: Player = await requireStaff("SUPERADMIN");
  const members = await listStaff();

  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <AddMemberForm />
      <DataTable caption={t.title}>
        <thead>
          <tr>
            <th scope="col" className={th}>{t.columns.name}</th>
            <th scope="col" className={th}>{t.columns.role}</th>
            <th scope="col" className={th}>{t.columns.since}</th>
            <th scope="col" className={th}>{t.columns.grantedBy}</th>
            <th scope="col" className={th}>{t.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const isMe = member.uuid === me.uuid;
            return (
              <tr key={member.uuid}>
                <td className={`${td} font-semibold`}>
                  {member.name}
                  {isMe ? <span className="badge badge-paper ml-2">{t.you}</span> : null}
                </td>
                <td className={td}>
                  <span className={`badge ${member.role === "SUPERADMIN" ? "badge-ink" : "badge-paper"}`}>
                    {m.status.staff[member.role]}
                  </span>
                </td>
                <td className={`${td} num whitespace-nowrap`}>{formatDate(member.since)}</td>
                <td className={td}>{member.grantedByName ?? m.common.none}</td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Role switch: the current role is pressed; the other one submits the change. */}
                    <ActionForm
                      action={setStaffRoleAction}
                      confirm={isMe ? t.demoteSelfConfirm : undefined}
                      className="inline-grid grid-cols-2 border-2 border-edge bg-surface text-sm"
                    >
                      <input type="hidden" name="playerUuid" value={member.uuid} />
                      <span role="group" aria-label={fmt(t.roleGroup, { name: member.name })} className="contents">
                        {STAFF_ROLES.map((role) => {
                          const current = member.role === role;
                          return (
                            <SubmitButton
                              key={role}
                              name="role"
                              value={role}
                              disabled={current}
                              pendingLabel={t.saving}
                              className={`px-3 py-1 font-semibold not-first:border-l-2 not-first:border-edge ${
                                current ? "bg-ink text-paper" : "hover:bg-paper"
                              }`}
                            >
                              {m.status.staff[role]}
                            </SubmitButton>
                          );
                        })}
                      </span>
                    </ActionForm>
                    <ActionForm
                      action={removeStaffAction}
                      confirm={isMe ? t.removeSelfConfirm : fmt(t.removeConfirm, { name: member.name })}
                    >
                      <input type="hidden" name="playerUuid" value={member.uuid} />
                      <SubmitButton className="btn btn-danger btn-sm" pendingLabel={t.saving}>
                        {t.remove}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}
