import type { ReactNode } from "react";
import { m } from "@/i18n";

/** Title block of an admin page: mono label, h1, short intro and optional actions. */
export function AdminPageHeader({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-edge pb-3">
      <div className="min-w-0">
        <p className="label">{m.admin.label}</p>
        <h1 className="text-2xl">{title}</h1>
        {intro ? <p className="mt-1 text-sm text-ink-2">{intro}</p> : null}
      </div>
      {children}
    </header>
  );
}
