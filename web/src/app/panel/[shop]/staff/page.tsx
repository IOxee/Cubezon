import type { Metadata } from "next";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { getMaxMemberships, getOrdersMode, getShopMembers, type ShopMember } from "@/lib/data/roleplay";
import { requireSellerShop, staffActor } from "@/lib/data/seller";
import { getShopRoles, type ShopRole } from "@/lib/data/shop-roles";
import { formatDate } from "@/lib/format";
import { can, canAssignRole, canManageMember, type StaffActor } from "@/lib/seller/permissions";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { PanelHeader, PanelSkeleton } from "../../_components/panel-ui";
import { EmployeeForm } from "./_components/employee-form";
import { addEmployeeAction, changeMemberRoleAction, removeEmployeeAction } from "./actions";

export const metadata: Metadata = { title: m.roleplay.employees.metaTitle };

const t = m.roleplay.employees;

type Props = PageProps<"/panel/[shop]/staff">;

/**
 * Employees of one shop (shop_members) and their ranks. The whole staff sees the list (as in the
 * game); hiring, firing and changing ranks need staff.manage, with the rules of
 * lib/seller/permissions (checked again in every action).
 */
export default function EmployeesPage({ params }: Props) {
  return (
    <>
      <PanelHeader title={t.title} />
      <Suspense fallback={<PanelSkeleton rows={3} />}>
        <Employees params={params} />
      </Suspense>
    </>
  );
}

async function Employees({ params }: Pick<Props, "params">) {
  const { shop: shopSlug } = await params;
  const { player, shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "staff"));
  const [members, roles, mode, maxMemberships] = await Promise.all([
    getShopMembers(shop.id),
    getShopRoles(shop.id),
    getOrdersMode(),
    getMaxMemberships(),
  ]);
  const editable = canEditShop(shop.status);
  const actor = staffActor(shop);
  const manages = editable && can(actor, "staff.manage");
  const assignable = roles.filter((role) => canAssignRole(actor, role.permissions));

  return (
    <div className="space-y-6">
      <p className="max-w-prose text-ink-2">{t.intro}</p>
      <p className="max-w-prose text-sm text-ink-3">{plural(maxMemberships, t.limitNote)}</p>
      {mode === "automatic" ? <Notice>{t.automaticNote}</Notice> : null}
      {editable ? null : <Notice tone="danger">{t.suspended}</Notice>}
      {editable && !can(actor, "staff.manage") ? <Notice>{t.readOnly}</Notice> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="employees-list" className="space-y-3">
          <h2 id="employees-list" className="sr-only">
            {t.caption}
          </h2>
          <p className="text-sm text-ink-3">{plural(members.length, t.count)}</p>
          {members.length > 0 ? (
            <MembersTable
              shopSlug={shop.slug}
              members={members}
              assignable={assignable}
              actor={actor}
              manages={manages}
              selfUuid={player.uuid}
            />
          ) : (
            <EmptyState icon="armor_stand" title={t.empty.title} body={t.empty.body} />
          )}
        </section>

        <div className="space-y-6">
          {manages && assignable.length > 0 ? (
            <EmployeeForm
              action={addEmployeeAction.bind(null, shop.slug)}
              roles={assignable.map((role) => ({ id: role.id, name: role.name }))}
              defaultRoleId={(assignable.find((role) => role.isDefault) ?? assignable[0]).id}
            />
          ) : null}
          {manages && assignable.length === 0 ? <Notice>{t.noAssignableRoles}</Notice> : null}
          <GameCommands slug={shop.slug} />
        </div>
      </div>
    </div>
  );
}

function MembersTable({
  shopSlug,
  members,
  assignable,
  actor,
  manages,
  selfUuid,
}: {
  shopSlug: string;
  members: ShopMember[];
  assignable: ShopRole[];
  actor: StaffActor;
  manages: boolean;
  selfUuid: string;
}) {
  const remove = removeEmployeeAction.bind(null, shopSlug);
  const changeRole = changeMemberRoleAction.bind(null, shopSlug);
  return (
    <div className="overflow-x-auto border-2 border-edge bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b-2 border-edge text-left">
            <th scope="col" className="label px-3 py-2">{t.columns.player}</th>
            <th scope="col" className="label px-3 py-2">{t.columns.role}</th>
            <th scope="col" className="label px-3 py-2">{t.columns.since}</th>
            <th scope="col" className="label px-3 py-2">{t.columns.addedBy}</th>
            <th scope="col" className="label px-3 py-2 text-right">{t.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const name = member.name ?? t.unknownPlayer;
            const manageable = manages && canManageMember(actor, member.role?.permissions ?? []);
            return (
              <tr key={member.playerUuid} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2 font-semibold">
                  {name}
                  {member.playerUuid === selfUuid ? <span className="ml-1 font-normal text-ink-3">{t.you}</span> : null}
                </td>
                <td className="px-3 py-2">
                  {manageable && assignable.length > 0 ? (
                    <form action={changeRole} className="flex items-center gap-1">
                      <input type="hidden" name="player" value={member.playerUuid} />
                      <select
                        name="role"
                        defaultValue={member.role?.id ?? ""}
                        aria-label={fmt(t.roleLabel, { name })}
                        className="input py-1 text-sm"
                      >
                        {member.role ? null : <option value="">{t.noRole}</option>}
                        {assignable.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn btn-sm btn-ghost" pendingLabel={t.changingRole}>
                        {t.changeRole}
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="badge badge-paper">{member.role?.name ?? t.noRole}</span>
                  )}
                </td>
                <td className="num px-3 py-2 text-xs whitespace-nowrap text-ink-2">{formatDate(member.since)}</td>
                <td className="px-3 py-2 text-ink-2">{member.addedByName ?? m.common.none}</td>
                <td className="px-3 py-2 text-right">
                  {manageable ? (
                    <form action={remove}>
                      <input type="hidden" name="player" value={member.playerUuid} />
                      <SubmitButton className="btn btn-sm btn-ghost btn-danger" pendingLabel={t.removing}>
                        {t.remove}
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-ink-3">{m.common.none}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The same commands in the game, with this shop's slug filled in. */
function GameCommands({ slug }: { slug: string }) {
  const commands = m.roleplay.commands;
  return (
    <section aria-labelledby="employees-game" className="card-soft p-4">
      <h2 id="employees-game" className="label mb-2">
        {t.game}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {[commands.employeeAddShop, commands.employeeRemoveShop, commands.employeeListShop].map((command) => (
          <li key={command}>
            <code className="cmd break-all">{fmt(command, { slug })}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
