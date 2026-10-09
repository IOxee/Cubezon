import type { ReactNode } from "react";

/** Thermal till receipt (cart summary, checkout review and order receipt). */
export function Ticket({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  /** Accessible name of the receipt. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={`ticket-shadow ${className}`}>
      <section aria-label={label} className="ticket flex flex-col gap-2">
        {children}
      </section>
    </div>
  );
}

/** Centered header: shop name in pixel type and a mono subtitle. */
export function TicketHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col items-center gap-0.5 text-center">
      <span className="font-pixel text-lg leading-none font-bold tracking-wide">{title}</span>
      {subtitle ? <span className="text-xs tracking-[0.06em] text-ink-2 uppercase">{subtitle}</span> : null}
    </header>
  );
}

export function TicketRule() {
  return <div aria-hidden className="ticket-rule my-1" />;
}

/** Label on the left, value (usually money) right aligned. */
export function TicketRow({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-ink-2" : ""}`}
    >
      <span className="min-w-0">{label}</span>
      <span className="num shrink-0 text-right">{value}</span>
    </div>
  );
}
