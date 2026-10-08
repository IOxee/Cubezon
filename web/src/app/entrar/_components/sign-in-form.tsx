"use client";

import { useActionState } from "react";
import { m } from "@/i18n";
import { signInAction, type SignInState } from "../actions";

const INITIAL: SignInState = { error: null, code: "" };

/** Link code form: one big mono field, errors under it. */
export function SignInForm({ next }: { next: string }) {
  const t = m.account.signIn;
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);
  const describedBy = state.error ? "code-hint code-error" : "code-hint";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="code" className="label">
        {t.codeLabel}
      </label>
      <input
        key={state.code}
        id="code"
        name="code"
        type="text"
        defaultValue={state.code}
        placeholder={t.placeholder}
        required
        maxLength={9}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={describedBy}
        className="input num h-16 text-center text-3xl tracking-[0.35em] uppercase placeholder:tracking-[0.35em]"
      />
      <p id="code-hint" className="text-xs text-ink-3">
        {t.codeHint}
      </p>
      {state.error ? (
        <p id="code-error" role="alert" className="border-2 border-danger bg-surface px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending} aria-disabled={pending}>
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
