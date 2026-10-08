import type { CSSProperties, ReactNode } from "react";

const TONES = {
  ink: "var(--ink)",
  muted: "var(--ink-3)",
  danger: "var(--danger)",
  success: "var(--success)",
  shop: "var(--shop-ink, var(--ink))",
} as const;

const SIZES = { sm: "text-xs", md: "text-sm", lg: "text-lg" } as const;

/** Crooked rubber stamp (the signature of the design): AGOTADO, OFICIAL, RECOGIDO… */
export function Stamp({
  children,
  tone = "ink",
  size = "md",
  rotate = -4,
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  rotate?: number;
  className?: string;
}) {
  const style = { "--stamp-ink": TONES[tone], "--stamp-rotate": `${rotate}deg` } as CSSProperties;
  return (
    <span className={`stamp ${SIZES[size]} ${className}`} style={style}>
      {children}
    </span>
  );
}
