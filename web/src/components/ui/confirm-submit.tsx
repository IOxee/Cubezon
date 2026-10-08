"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that asks for confirmation first. When blocked it stays focusable and keeps its
 * title (a disabled button would hide the reason), but never submits.
 */
export function ConfirmSubmit({
  children,
  message,
  blockedReason,
  className = "btn btn-sm btn-danger",
}: {
  children: ReactNode;
  message: string;
  blockedReason?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const blocked = Boolean(blockedReason);
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={blocked || pending}
      title={blockedReason}
      onClick={(event) => {
        if (blocked || !window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
