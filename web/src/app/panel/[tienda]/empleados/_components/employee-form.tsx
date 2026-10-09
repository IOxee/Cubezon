"use client";

import { useActionState } from "react";
import { m } from "@/i18n";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import type { EmployeeFormState } from "../actions";

const t = m.roleplay.employees;
const INITIAL: EmployeeFormState = { status: "idle", message: null, name: "" };

/**
 * Adds an employee by Minecraft name with one of the ranks the actor may give (the shop slug is
 * bound to the action by the page).
 */
export function EmployeeForm({
  action,
  roles,
  defaultRoleId,
}: {
  action: (state: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;
  roles: { id: string; name: string }[];
  defaultRoleId: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const error = state.status === "error";

  return (
    <form action={formAction} className="card flex flex-col gap-3 p-4">
      <h2 className="text-lg">{t.add.title}</h2>
      <div>
        <label htmlFor="employee-name" className="label">
          {t.add.label}
        </label>
        <input
          id="employee-name"
          name="name"
          // After the action React resets the form to this value: keep what was typed on errors.
          defaultValue={state.name}
          required
          maxLength={40}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={t.add.placeholder}
          aria-invalid={error || undefined}
          aria-describedby="employee-name-hint"
          className="input mt-1 w-full"
        />
        <p id="employee-name-hint" className="mt-1 text-xs text-ink-3">
          {t.add.hint}
        </p>
      </div>
      <div>
        <label htmlFor="employee-role" className="label">
          {t.add.role}
        </label>
        <select
          id="employee-role"
          name="role"
          defaultValue={defaultRoleId}
          aria-describedby="employee-role-hint"
          className="input mt-1 w-full"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <p id="employee-role-hint" className="mt-1 text-xs text-ink-3">
          {t.add.roleHint}
        </p>
      </div>
      {state.message ? <Notice tone={error ? "danger" : "success"}>{state.message}</Notice> : null}
      <SubmitButton className="btn btn-primary self-start" pendingLabel={t.add.submitting}>
        {t.add.submit}
      </SubmitButton>
    </form>
  );
}
