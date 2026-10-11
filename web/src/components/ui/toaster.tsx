"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "@/i18n";

export type ToastTone = "success" | "error";

type Toast = { id: number; tone: ToastTone; message: string };

/** How long a toast stays: errors longer, so there is time to read them. */
const DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 8000 };
/** At most this many on screen; older ones leave first. */
const MAX_TOASTS = 3;

const listeners = new Set<(toast: Toast) => void>();
let nextId = 1;

/** Shows a temporary notification (bottom right). Callable from any client component. */
export function toast(tone: ToastTone, message: string): void {
  if (!message) return;
  const item = { id: nextId++, tone, message };
  listeners.forEach((listener) => listener(item));
}

/**
 * The notification area, mounted once in the root layout. Each toast closes by itself (paused
 * while the pointer is over it or it has focus) or with its button. Screen readers hear them
 * through the live region: polite for successes, assertive (role="alert") for errors.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (item: Toast) => setToasts((list) => [...list, item].slice(-MAX_TOASTS));
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const close = (id: number) => setToasts((list) => list.filter((item) => item.id !== id));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2"
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} onClose={close} />
      ))}
    </div>
  );
}

function ToastItem({ toast: item, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => closeRef.current(item.id), DURATION_MS[item.tone]);
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone, paused]);

  const error = item.tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`toast pointer-events-auto flex items-start gap-3 border-2 border-l-8 border-edge bg-surface px-3 py-2 text-sm font-semibold shadow-hard ${
        error ? "border-l-danger text-danger" : "border-l-success text-ink"
      }`}
    >
      <span aria-hidden className={`mt-px font-mono ${error ? "text-danger" : "text-success"}`}>
        {error ? "✖" : "✔"}
      </span>
      <p className="min-w-0 flex-1">{item.message}</p>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        className="-my-0.5 shrink-0 px-1 text-ink-3 hover:text-ink"
        aria-label={m.a11y.close}
      >
        ×
      </button>
    </div>
  );
}
