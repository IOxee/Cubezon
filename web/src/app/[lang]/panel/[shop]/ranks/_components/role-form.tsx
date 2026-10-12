"use client";

import { useActionState, useEffect, useId } from "react";
import { useMessages } from "@/i18n/client";
import { ROLE_NAME_MAX, SHOP_PERMISSIONS, type ShopPermission } from "@/lib/seller/permissions";
import { useCloseModal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import type { RoleFormState } from "../actions";

const INITIAL: RoleFormState = { status: "idle", message: null };

/**
 * Name and permissions of a rank. Without `role` it creates a new one. After an error the form
 * keeps what was sent; after saving it closes its modal (the page shows the stored values).
 */
export function RoleForm({
  action,
  role,
}: {
  action: (state: RoleFormState, formData: FormData) => Promise<RoleFormState>;
  role?: { id: string; name: string; permissions: ShopPermission[] };
}) {
  const m = useMessages();
  const t = m.roles;
  const [state, formAction] = useActionState(action, INITIAL);
  const id = useId();
  const closeModal = useCloseModal();

  useEffect(() => {
    if (state.status === "saved") closeModal?.();
  }, [state, closeModal]);
  const values = state.status === "error" ? state.values : undefined;
  const name = values?.name ?? role?.name ?? "";
  const permissions = values?.permissions ?? role?.permissions ?? [];

  return (
    // The key resets the uncontrolled fields when the stored values change.
    <form action={formAction} key={`${name}|${permissions.join(",")}`} className="flex flex-col gap-3">
      {role ? <input type="hidden" name="id" value={role.id} /> : null}
      <div>
        <label htmlFor={`${id}-name`} className="label">
          {t.form.name}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          defaultValue={name}
          required
          maxLength={ROLE_NAME_MAX}
          autoComplete="off"
          placeholder={t.form.namePlaceholder}
          aria-invalid={state.nameError ? true : undefined}
          aria-describedby={state.nameError ? `${id}-name-error` : undefined}
          className="input mt-1 w-full"
        />
        {state.nameError ? (
          <p id={`${id}-name-error`} className="mt-1 text-xs text-danger">
            {state.nameError}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="label">{t.permissionsLegend}</legend>
        <ul className="mt-1 flex flex-col gap-1.5">
          {SHOP_PERMISSIONS.map((permission) => (
            <li key={permission}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission}
                  defaultChecked={permissions.includes(permission)}
                  className="mt-1 accent-ink"
                />
                <span>
                  <span className="font-semibold">{t.permissions[permission]}</span>
                  <span className="block text-xs text-ink-3">{t.permissionHints[permission]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {state.message && !state.nameError ? (
        <Notice tone={state.status === "error" ? "danger" : "success"}>{state.message}</Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn btn-primary" pendingLabel={role ? t.form.saving : t.form.creating}>
          {role ? t.form.save : t.form.create}
        </SubmitButton>
        {closeModal ? (
          <button type="button" className="btn btn-ghost" onClick={closeModal}>
            {m.common.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
