"use client";

import { useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";

/** Result of an admin Server Action, shown under its form. */
export type ActionState = { status: "idle" | "ok" | "error"; message: string };

const IDLE: ActionState = { status: "idle", message: "" };

/**
 * Form bound to a Server Action with useActionState. Shows the action's message and, on
 * error, restores what the admin typed (React resets the form after every action).
 * `confirm` asks before submitting (destructive actions). `inline` is for single buttons in a row:
 * the message floats under the button instead of pushing the rest of the row around.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  inline = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (state.status !== "error" || !form || !submitted.current) return;
    for (const [name, value] of submitted.current) {
      const field = form.elements.namedItem(name);
      if (
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
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={inline ? `relative ${className ?? ""}` : className}>
      {children}
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`font-semibold ${state.status === "error" ? "text-danger" : "text-success"} ${
            inline
              ? "absolute top-full right-0 z-10 mt-1 w-max max-w-xs border border-edge bg-surface px-2 py-1 text-xs shadow-hard-sm"
              : "basis-full text-sm"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
