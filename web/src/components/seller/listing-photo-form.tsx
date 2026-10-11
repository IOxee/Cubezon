"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { fmt, m } from "@/i18n";
import { checkImageFile, IDLE_IMAGE_STATE, SHOP_IMAGE_ACCEPT, type ShopImageError, type ShopImageState } from "@/lib/shop-media";
import { ItemIcon } from "@/components/ui/item-icon";

const t = m.seller.images;

/**
 * Upload, replace or remove a product's photo. Same flow as ShopImageForm: the file is checked
 * here (type and size) and previewed before uploading, the server checks it again with its bytes,
 * and a hidden second form (intent=remove) shares the action state for the remove button.
 */
export function ListingPhotoForm({
  action,
  currentUrl,
  title,
  material,
}: {
  action: (state: ShopImageState, formData: FormData) => Promise<ShopImageState>;
  currentUrl: string | null;
  /** Product title (alt text) and material (icon shown while there is no photo). */
  title: string;
  material: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_IMAGE_STATE);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<ShopImageError | null>(null);
  const [intent, setIntent] = useState<"upload" | "remove">("upload");
  const [handledState, setHandledState] = useState(state);
  const texts = t.photo;

  // A new result: React reset the form, so the chosen file (and its preview) is gone.
  if (state !== handledState) {
    setHandledState(state);
    setPreview(null);
    setFileError(null);
  }

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
      <label htmlFor="listing-photo-file" className="label">
        {texts.title}
      </label>
      <div className="squares flex aspect-square items-center justify-center overflow-hidden border-2 border-edge">
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user image (bucket or local preview)
          <img src={shownUrl} alt={fmt(m.catalog.media.photoAlt, { title })} className="size-full object-cover" decoding="async" />
        ) : (
          <ItemIcon material={material} size={96} alt="" />
        )}
      </div>
      <p className="text-xs text-ink-3">{caption}</p>

      <form action={formAction} onSubmit={() => setIntent("upload")} className="grid gap-2">
        <input
          id="listing-photo-file"
          type="file"
          name="image"
          accept={SHOP_IMAGE_ACCEPT}
          required
          onChange={onFileChange}
          className="input text-sm file:mr-3 file:border-2 file:border-edge file:bg-paper file:px-2 file:py-0.5 file:font-semibold"
          aria-invalid={error ? true : undefined}
          aria-describedby="listing-photo-hint listing-photo-feedback"
        />
        <p id="listing-photo-hint" className="text-xs text-ink-3">
          {texts.hint}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-sm btn-ink" disabled={pending} aria-disabled={pending}>
            {pending && intent === "upload" ? t.uploading : texts.upload}
          </button>
          {currentUrl ? (
            <button type="submit" form="listing-photo-remove" className="btn btn-sm btn-ghost" disabled={pending} aria-disabled={pending}>
              {pending && intent === "remove" ? t.removing : texts.remove}
            </button>
          ) : null}
        </div>
      </form>
      {currentUrl ? (
        <form id="listing-photo-remove" action={formAction} onSubmit={() => setIntent("remove")} hidden>
          <input type="hidden" name="intent" value="remove" />
        </form>
      ) : null}

      <div id="listing-photo-feedback" aria-live="polite" className="empty:hidden">
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
