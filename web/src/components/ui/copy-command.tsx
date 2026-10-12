"use client";

import { useState } from "react";
import { useMessages } from "@/i18n/client";

/** A game command shown as a key chip, with a button that copies it to the clipboard. */
export function CopyCommand({ command }: { command: string }) {
  const m = useMessages();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className="cmd">{command}</code>
      <button type="button" onClick={copy} className="btn btn-ghost btn-sm" aria-live="polite">
        {copied ? m.common.copied : m.common.copy}
      </button>
    </span>
  );
}
