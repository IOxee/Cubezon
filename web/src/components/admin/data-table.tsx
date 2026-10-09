import type { ReactNode } from "react";

/** Class names for dense admin tables (header and body cells). */
export const th = "label border-b-2 border-edge bg-paper px-3 py-2 text-left whitespace-nowrap";
export const td = "border-b border-line px-3 py-2 align-top";

/** Bordered, horizontally scrollable table for admin lists. */
export function DataTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-2 border-edge bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
