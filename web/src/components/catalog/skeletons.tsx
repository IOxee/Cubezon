import { m } from "@/i18n";

export function ProductGridSkeleton({ count = 10, sidebar = false }: { count?: number; sidebar?: boolean }) {
  const columns = sidebar ? "sm:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  return (
    <div role="status" aria-label={m.a11y.loading} className={`grid grid-cols-2 gap-3 ${columns}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card flex flex-col">
          <div className="squares aspect-[4/3]" />
          <div className="perforation" />
          <div className="flex flex-col gap-2 p-3">
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-2/5" />
            <div className="skeleton mt-3 h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic block placeholder (headers, panels). */
export function BlockSkeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
