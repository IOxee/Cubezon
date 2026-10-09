"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { fmt, m } from "@/i18n";
import { inkStyle } from "@/lib/inks";
import {
  checkImageFile,
  IDLE_IMAGE_STATE,
  SHOP_IMAGE_ACCEPT,
  type ShopImageError,
  type ShopImageState,
  type ShopMediaKind,
} from "@/lib/shop-media";
import { ShopSeal } from "@/components/ui/shop-mark";

const t = m.seller.images;

/**
 * Upload, replace or remove the shop's logo or banner. The chosen file is checked here (type
 * and size, so a big file never reaches the Server Action) and previewed before uploading; the
 * server checks it again, bytes included. Two forms share one action state: the upload one
 * and a remove one (intent=remove, without the file), whose button sits next to "upload".
 */
export function ShopImageForm({
  kind,
  action,
  currentUrl,
  name,
  ink,
}: {
  kind: ShopMediaKind;
  action: (state: ShopImageState, formData: FormData) => Promise<ShopImageState>;
  currentUrl: string | null;
  /** Shop name and ink, for the seal shown while there is no logo. */
  name: string;
  ink: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_IMAGE_STATE);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<ShopImageError | null>(null);
  const [intent, setIntent] = useState<"upload" | "remove">("upload");
  const [handledState, setHandledState] = useState(state);
  const texts = t[kind];
  const id = (part: string) => `shop-${kind}-${part}`;

  // A new result: React reset the form, so the chosen file (and its preview) is gone.
  if (state !== handledState) {
    setHandledState(state);
    setPreview(null);
    setFileError(null);
  }

  // Frees the preview's object URL when it changes or the form goes away.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const problem = file ? checkImageFile(file) : null;
    setFileError(problem);
    if (!file || problem) {
      if (problem) event.target.value = "";
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  const error = fileError ?? (state.status === "error" ? state.error : null);
  const shownUrl = preview ?? currentUrl;
  const caption = preview ? t.selected : currentUrl ? t.current : texts.empty;

  return (
    <div className="grid content-start gap-3">
      <label htmlFor={id("file")} className="label">
        {texts.title}
      </label>

      {kind === "logo" ? (
        <div className="squares flex h-28 items-center justify-center">
          <ShopSeal name={name} ink={ink} size={80} logoUrl={shownUrl} />
        </div>
      ) : (
        <div className="squares aspect-[4/1] border-2 border-edge" style={inkStyle(ink)}>
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user image (bucket or local preview)
            <img
              src={shownUrl}
              alt={fmt(m.catalog.media.bannerAlt, { name })}
              className="size-full object-cover"
              decoding="async"
            />
          ) : (
            <div aria-hidden className="flex h-full items-end">
              <div className="h-3 w-full bg-shop" />
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-ink-3">{caption}</p>

      <form action={formAction} onSubmit={() => setIntent("upload")} className="grid gap-2">
        <input
          id={id("file")}
          type="file"
          name="image"
          accept={SHOP_IMAGE_ACCEPT}
          required
          onChange={onFileChange}
          className="input text-sm file:mr-3 file:border-2 file:border-edge file:bg-paper file:px-2 file:py-0.5 file:font-semibold"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id("hint")} ${id("feedback")}`}
        />
        <p id={id("hint")} className="text-xs text-ink-3">
          {texts.hint}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-sm btn-ink" disabled={pending} aria-disabled={pending}>
            {pending && intent === "upload" ? t.uploading : texts.upload}
          </button>
          {currentUrl ? (
            <button
              type="submit"
              form={id("remove")}
              className="btn btn-sm btn-ghost"
              disabled={pending}
              aria-disabled={pending}
            >
              {pending && intent === "remove" ? t.removing : texts.remove}
            </button>
          ) : null}
        </div>
      </form>
      {currentUrl ? (
        <form id={id("remove")} action={formAction} onSubmit={() => setIntent("remove")} hidden>
          <input type="hidden" name="intent" value="remove" />
        </form>
      ) : null}

      <div id={id("feedback")} aria-live="polite" className="empty:hidden">
        {error ? (
          <p className="text-sm font-semibold text-danger">{m.seller.errors[error]}</p>
        ) : !preview && state.status === "saved" ? (
          <p className="text-sm font-semibold text-success">{texts.saved}</p>
        ) : !preview && state.status === "removed" ? (
          <p className="text-sm font-semibold text-success">{texts.removed}</p>
        ) : null}
      </div>
    </div>
  );
}
