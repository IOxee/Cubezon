"use client";

import { useFormat, useMessages } from "@/i18n/client";

const SIZES = { sm: "text-sm", md: "text-md", lg: "text-xl", xl: "text-2xl" } as const;

/** Game money in mono with tabular figures: 1.250,00 $ */
export function Price({
  amount,
  size = "md",
  className = "",
}: {
  amount: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const m = useMessages();
  const f = useFormat();
  return (
    <span className={`num font-semibold whitespace-nowrap ${SIZES[size]} ${className}`}>
      {f.amount(amount)}
      <span className="text-[0.75em] text-ink-2">{m.money.suffix}</span>
    </span>
  );
}
