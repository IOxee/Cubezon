"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Menu that opens under its button. Built on <details>, so it works without JavaScript; with
 * it, it also closes on an outside click, on Escape and after choosing a link.
 */
export function Dropdown({
  summary,
  summaryClassName = "btn btn-ghost",
  align = "start",
  label,
  children,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  align?: "start" | "end";
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (details.open && event.key === "Escape") {
        close();
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary className={`${summaryClassName} list-none [&::-webkit-details-marker]:hidden`}>
        {summary}
        <svg
          viewBox="0 0 10 6"
          width="10"
          height="6"
          aria-hidden="true"
          shapeRendering="crispEdges"
          className="shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="M0 0h10v2H8v2H6v2H4V4H2V2H0z" fill="currentColor" />
        </svg>
      </summary>
      <div
        aria-label={label}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
        }}
        className={`absolute top-full z-40 mt-1 min-w-56 border-2 border-edge bg-surface p-1 shadow-hard ${
          align === "end" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}
