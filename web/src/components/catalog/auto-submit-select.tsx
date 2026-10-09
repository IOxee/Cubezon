"use client";

import type { ComponentProps } from "react";

/**
 * Select that submits its form as soon as it changes (also when attached to a form elsewhere
 * with the form attribute). Without JavaScript the form still needs its submit button.
 */
export function AutoSubmitSelect(props: Omit<ComponentProps<"select">, "onChange">) {
  return <select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
