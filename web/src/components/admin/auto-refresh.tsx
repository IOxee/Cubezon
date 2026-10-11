"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Seconds between refreshes of the admin pages (moderation queues, orders, photos…). */
export const ADMIN_REFRESH_SECONDS = 15;

/**
 * Keeps the admin pages fresh for moderation: refreshes the server data every few seconds while the
 * tab is visible, and at once when it becomes visible again. It never interrupts someone using a
 * form: while focus is inside one, the refresh waits. Client state (and what was typed in
 * uncontrolled fields) survives a refresh.
 */
export function AutoRefresh({ seconds = ADMIN_REFRESH_SECONDS }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    function tick() {
      if (document.visibilityState !== "visible") return;
      if (document.activeElement?.closest("form")) return;
      router.refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") tick();
    }
    const timer = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
