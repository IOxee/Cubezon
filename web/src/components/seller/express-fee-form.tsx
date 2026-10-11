"use client";

import { useActionState } from "react";
import { fmt, m } from "@/i18n";
import { idleState, type ExpressFeeField, type FormState } from "@/lib/seller/validation";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormFeedback } from "./form-feedback";

const t = m.seller.expressFee;

/**
 * The shop's own express fee: a decimal field (empty = the server's fee) and save. `initial` is
 * the stored fee as typed ("12,50") or empty; labels come formatted from the server. The action
 * validates it again (lib/delivery validateShopExpressFee).
 */
export function ExpressFeeForm({
  action,
  initial,
  serverFeeLabel,
  maxLabel,
}: {
  action: (state: FormState<ExpressFeeField>, formData: FormData) => Promise<FormState<ExpressFeeField>>;
  initial: string;
  serverFeeLabel: string;
  /** Highest fee allowed, for the range error. */
  maxLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState<ExpressFeeField>());
  const error = state.fieldErrors.expressFee;
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} savedMessage={t.saved} />
      <div>
        <label htmlFor="express-fee" className="label">
          {t.field}
        </label>
        <input
          id="express-fee"
          name="expressFee"
          defaultValue={initial}
          inputMode="decimal"
          autoComplete="off"
          placeholder={fmt(t.placeholder, { fee: serverFeeLabel })}
          className="input num w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby="express-fee-hint express-fee-error"
        />
        <p id="express-fee-hint" className="mt-1 text-xs text-ink-3">
          {t.hint}
        </p>
        <FieldError id="express-fee-error" code={error} values={{ max: maxLabel }} />
      </div>
      <SubmitButton className="btn btn-sm btn-block" pendingLabel={t.saving}>
        {t.save}
      </SubmitButton>
    </form>
  );
}
