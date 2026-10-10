import type { Metadata } from "next";
import { Suspense } from "react";
import { fmt, m, plural } from "@/i18n";
import { requireSellerShop } from "@/lib/data/seller";
import { getMaxShopRoles, getShopRoles, type ShopRole } from "@/lib/data/shop-roles";
import { SHOP_PERMISSIONS } from "@/lib/seller/permissions";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { PanelHeader, PanelSkeleton } from "../../_components/panel-ui";
import { RoleForm } from "./_components/role-form";
import { deleteRoleAction, saveRoleAction, setDefaultRoleAction } from "./actions";

export const metadata: Metadata = { title: m.roles.metaTitle };

const t = m.roles;

type Props = PageProps<"/panel/[tienda]/rangos">;

/**
 * Ranks of one shop (shop_roles) in a table; each one is edited in a modal. Only the owner sees
 * this page and changes them: requireSellerShop(ownerOnly) here and again in every action.
 */
export default function RolesPage({ params }: Props) {
  return (
    <>
      <PanelHeader title={t.title} />
      <Suspense fallback={<PanelSkeleton rows={3} />}>
        <Roles params={params} />
      </Suspense>
    </>
  );
}

async function Roles({ params }: Pick<Props, "params">) {
  const { tienda } = await params;
  const { shop } = await requireSellerShop(tienda, panelPath(tienda, "rangos"), { ownerOnly: true });
  const [roles, max] = await Promise.all([getShopRoles(shop.id), getMaxShopRoles()]);
  const editable = canEditShop(shop.status);
  const fallback = roles.find((role) => role.isDefault)?.name ?? m.roleplay.employees.noRole;
  const save = saveRoleAction.bind(null, shop.slug);

  return (
    <div className="space-y-6">
      <div className="max-w-prose space-y-2">
        <p className="text-ink-2">{t.intro}</p>
        <p className="text-sm text-ink-3">{t.staffNote}</p>
      </div>
      {editable ? null : <Notice tone="danger">{t.suspended}</Notice>}

      <section aria-labelledby="roles-list" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="roles-list" className="text-sm text-ink-3">
            {plural(max, t.limitNote)}
          </h2>
          {editable && roles.length < max ? (
            <Modal title={t.newTitle} triggerLabel={t.newTitle} triggerClassName="btn btn-primary btn-sm">
              <RoleForm action={save} />
            </Modal>
          ) : null}
        </div>
        {editable && roles.length >= max ? <Notice>{t.limitReached}</Notice> : null}

        <div className="overflow-x-auto border-2 border-edge bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr className="border-b-2 border-edge text-left">
                <th scope="col" className="label px-3 py-2">{t.columns.name}</th>
                <th scope="col" className="label px-3 py-2">{t.columns.permissions}</th>
                <th scope="col" className="label px-3 py-2 text-right">{t.columns.members}</th>
                <th scope="col" className="label px-3 py-2 text-right">{t.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <RoleRow key={role.id} shopSlug={shop.slug} role={role} editable={editable} fallback={fallback} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function permissionSummary(role: ShopRole): string {
  if (role.permissions.length === 0) return t.noPermissions;
  if (role.permissions.length === SHOP_PERMISSIONS.length) return t.allPermissions;
  return role.permissions.map((permission) => t.permissions[permission]).join(" · ");
}

function RoleRow({
  shopSlug,
  role,
  editable,
  fallback,
}: {
  shopSlug: string;
  role: ShopRole;
  editable: boolean;
  fallback: string;
}) {
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="px-3 py-2 text-left">
        <span className="font-semibold">{role.name}</span>
        {role.isDefault ? (
          <span className="badge badge-ink ml-2 align-middle" title={t.defaultHint}>
            {t.default}
          </span>
        ) : null}
      </th>
      <td className={`px-3 py-2 ${role.permissions.length === 0 ? "text-ink-3" : "text-ink-2"}`}>{permissionSummary(role)}</td>
      <td className="num px-3 py-2 text-right whitespace-nowrap">{role.members}</td>
      <td className="px-3 py-2">
        {editable ? (
          <div className="flex justify-end gap-1">
            <Modal title={fmt(t.editTitle, { name: role.name })} triggerLabel={t.edit} triggerClassName="btn btn-sm">
              <RoleForm
                action={saveRoleAction.bind(null, shopSlug)}
                role={{ id: role.id, name: role.name, permissions: role.permissions }}
              />
            </Modal>
            {role.isDefault ? null : (
              <form action={setDefaultRoleAction.bind(null, shopSlug)}>
                <input type="hidden" name="id" value={role.id} />
                <SubmitButton className="btn btn-sm btn-ghost whitespace-nowrap" pendingLabel={t.makingDefault}>
                  {t.makeDefault}
                </SubmitButton>
              </form>
            )}
            {/* The default rank cannot be deleted (the database refuses): choose another default first. */}
            {role.isDefault ? null : (
              <form action={deleteRoleAction.bind(null, shopSlug)}>
                <input type="hidden" name="id" value={role.id} />
                <ConfirmSubmit
                  message={fmt(t.confirmRemove, { name: role.name, fallback })}
                  className="btn btn-sm btn-ghost btn-danger"
                >
                  {t.remove}
                </ConfirmSubmit>
              </form>
            )}
          </div>
        ) : (
          <span className="block text-right text-ink-3">{m.common.none}</span>
        )}
      </td>
    </tr>
  );
}
