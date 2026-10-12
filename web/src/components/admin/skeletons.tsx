import { getMessages } from "@/i18n/server";

async function Loading() {
  const m = await getMessages();
  return <span className="sr-only">{m.a11y.loading}</span>;
}

/** Fallback of the whole admin area while the session is checked (no admin text leaks). */
export function AdminShellSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <Loading />
      <div className="skeleton h-10 lg:h-56" />
      <div className="grid content-start gap-4">
        <div className="skeleton h-14 w-72 max-w-full" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="grid gap-1">
      <Loading />
      <div className="skeleton h-9" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-11 opacity-70" />
      ))}
    </div>
  );
}

export function TilesSkeleton({ tiles = 3 }: { tiles?: number }) {
  return (
    <div aria-busy="true" className="grid gap-4">
      <Loading />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-24" />
      <div className="skeleton h-40" />
    </div>
  );
}
