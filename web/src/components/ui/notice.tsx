import type { ReactNode } from "react";

const TONES = {
  info: "border-edge text-ink",
  success: "border-success text-success",
  danger: "border-danger text-danger",
} as const;

/** Inline message box (form results, warnings). */
export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`border-2 bg-surface px-4 py-3 text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
