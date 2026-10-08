"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { m } from "@/i18n";

const CloseContext = createContext<(() => void) | null>(null);

/** Inside a <Modal>: closes it (for example, after its form saved). Null outside a modal. */
export function useCloseModal(): (() => void) | null {
  return useContext(CloseContext);
}

/**
 * A button that opens a modal window (native <dialog>: focus trap, Esc and the backdrop come with
 * it). The content only exists while it is open, so every opening starts clean. A click on the
 * backdrop closes it.
 */
export function Modal({
  title,
  triggerLabel,
  triggerClassName = "btn btn-sm",
  children,
}: {
  title: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = useCallback(() => {
    ref.current?.close();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
  }, [open]);

  // Esc closes the dialog natively: unmount the content then too.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="dialog"
        onClick={() => {
          // Already rendered (closed with Esc before the state caught up): just show it again.
          if (open) ref.current?.showModal();
          else setOpen(true);
        }}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto border-2 border-edge bg-surface p-0 text-ink shadow-hard backdrop:bg-shadow/70"
      >
        {open ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b-2 border-edge px-4 py-3">
              <h2 id={titleId} className="min-w-0 truncate text-lg">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                className="btn btn-sm btn-ghost"
                aria-label={m.a11y.close}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <div className="p-4">
              <CloseContext value={close}>{children}</CloseContext>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
