"use client";

import { useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { toast } from "@/components/ui/toaster";

/** Result of an admin Server Action, shown under its form. */
export type ActionState = { status: "idle" | "ok" | "error"; message: string };

const IDLE: ActionState = { status: "idle", message: "" };

/**
 * Form bound to a Server Action with useActionState. The action's message shows as a temporary
 * notification and, on error, what the admin typed is restored (React resets the form after every
 * action). `confirm` asks before submitting (destructive actions).
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);

  // Each result is a temporary notification (components/ui/toaster), not text left under the form.
  useEffect(() => {
    if (state.status !== "idle") toast(state.status === "ok" ? "success" : "error", state.message);
  }, [state]);

  useEffect(() => {
    const form = formRef.current;
    if (state.status !== "error" || !form || !submitted.current) return;
    for (const [name, value] of submitted.current) {
      const field = form.elements.namedItem(name);
      if (field instanceof RadioNodeList) {
        field.value = typeof value === "string" ? value : "";
      } else if (
        (field instanceof HTMLInputElement && field.type !== "hidden") ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        field.value = typeof value === "string" ? value : "";
      }
    }
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirm && !window.confirm(confirm)) {
      event.preventDefault();
      return;
    }
    submitted.current = new FormData(event.currentTarget);
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}
