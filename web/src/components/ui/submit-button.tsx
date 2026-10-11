"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that disables itself and shows pendingLabel while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
  name,
  value,
  formAction,
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Also disabled when nothing would change (e.g. the option already chosen). */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      name={name}
      value={value}
      formAction={formAction}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
