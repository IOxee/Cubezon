"use client";

import { fmt } from "@/i18n";
import { useMessages } from "@/i18n/client";
import type { FieldErrorCode, FormState } from "@/lib/seller/validation";
import { Notice } from "@/components/ui/notice";

/** Error under a field (keep its id in the field's aria-describedby). Values fill {placeholders}. */
export function FieldError({
  id,
  code,
  values = {},
}: {
  id: string;
  code: FieldErrorCode | undefined;
  values?: Record<string, string | number>;
}) {
  const m = useMessages();
  return (
    <p id={id} className="mt-1 text-sm font-semibold text-danger empty:hidden">
      {code ? fmt(m.seller.errors[code], values) : null}
    </p>
  );
}

/** Result of the last submit: form-level error, "check the fields" or the saved message. */
export function FormFeedback<F extends string>({
  state,
  savedMessage,
}: {
  state: FormState<F>;
  savedMessage?: string;
}) {
  const m = useMessages();
  if (state.formError) return <Notice tone="danger">{m.seller.errors[state.formError]}</Notice>;
  if (state.status === "error") return <Notice tone="danger">{m.seller.errors.fixFields}</Notice>;
  if (state.status === "saved" && savedMessage) return <Notice tone="success">{savedMessage}</Notice>;
  return null;
}
