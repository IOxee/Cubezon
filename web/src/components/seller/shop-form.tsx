"use client";

import { useActionState, useState } from "react";
import { fmt, m } from "@/i18n";
import { INK_KEYS, inkStyle } from "@/lib/inks";
import {
  charLength,
  idleState,
  SHOP_DESCRIPTION_MAX,
  SHOP_NAME,
  SHOP_SLUG,
  slugDraft,
  slugify,
  type FormState,
  type ShopField,
} from "@/lib/seller/validation";
import { ShopSeal } from "@/components/ui/shop-mark";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormFeedback } from "./form-feedback";

export type ShopFormValues = { name: string; slug: string; description: string; ink: string };

const t = m.seller.shopForm;

/**
 * Shop request / shop details form. Controlled fields, so they survive the action's form reset;
 * the slug follows the name until the seller edits it (autoSlug). With resetOnSave (a new shop
 * request) the fields go back to `initial` after each successful submit, ready for another one.
 * Name and slug can always be edited (an old slug keeps redirecting to the shop).
 */
export function ShopForm({
  action,
  initial,
  slugHint = t.slugHint,
  logoUrl = null,
  autoSlug = false,
  resetOnSave = false,
  idPrefix = "shop",
  submitLabel,
  pendingLabel,
  savedMessage,
}: {
  action: (state: FormState<ShopField>, formData: FormData) => Promise<FormState<ShopField>>;
  initial: ShopFormValues;
  /** Help under the slug (an existing shop explains what happens to its old links). */
  slugHint?: string;
  /** Saved logo of the shop, for the preview. */
  logoUrl?: string | null;
  autoSlug?: boolean;
  resetOnSave?: boolean;
  /** Prefix of the field ids: several forms can share a page (/sell). */
  idPrefix?: string;
  submitLabel: string;
  pendingLabel: string;
  savedMessage?: string;
}) {
  const [state, formAction] = useActionState(action, idleState<ShopField>());
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!autoSlug);
  const [description, setDescription] = useState(initial.description);
  const [ink, setInk] = useState(initial.ink);
  const [handledState, setHandledState] = useState(state);
  const errors = state.fieldErrors;
  const id = (field: string) => `${idPrefix}-${field}`;

  // Adjusting state on a new action result (during render, as React recommends over an effect).
  if (state !== handledState) {
    setHandledState(state);
    if (resetOnSave && state.status === "saved") {
      setName(initial.name);
      setSlug(initial.slug);
      setSlugTouched(!autoSlug);
      setDescription(initial.description);
      setInk(initial.ink);
    }
  }
  const previewName = name.trim() || t.previewName;

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} savedMessage={savedMessage} />

      <div>
        <label htmlFor={id("name")} className="label mb-1 block">
          {t.name}
        </label>
        <input
          id={id("name")}
          name="name"
          className="input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          required
          minLength={SHOP_NAME.min}
          maxLength={SHOP_NAME.max}
          placeholder={t.namePlaceholder}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={`${id("name-hint")} ${id("name-error")}`}
        />
        <p id={id("name-hint")} className="mt-1 text-xs text-ink-3">
          {t.nameHint}
        </p>
        <FieldError id={id("name-error")} code={errors.name} />
      </div>

      <div>
        <label htmlFor={id("slug")} className="label mb-1 block">
          {t.slug}
        </label>
        <div className="flex">
          <span aria-hidden className="num flex items-center border-2 border-r-0 border-edge bg-paper px-2 text-sm text-ink-2">
            {t.slugPrefix}
          </span>
          <input
            id={id("slug")}
            name="slug"
            className="input num min-w-0 flex-1"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugDraft(event.target.value));
            }}
            onBlur={() => setSlug((current) => slugify(current))}
            required
            minLength={SHOP_SLUG.min}
            maxLength={SHOP_SLUG.max}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={`${id("slug-hint")} ${id("slug-error")}`}
          />
        </div>
        <p id={id("slug-hint")} className="mt-1 text-xs text-ink-3">
          {slugHint}
        </p>
        <FieldError id={id("slug-error")} code={errors.slug} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor={id("description")} className="label">
            {t.description}
          </label>
          <span className="num text-xs text-ink-3" aria-hidden>
            {fmt(t.counter, { count: charLength(description), max: SHOP_DESCRIPTION_MAX })}
          </span>
        </div>
        <textarea
          id={id("description")}
          name="description"
          className="input"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={SHOP_DESCRIPTION_MAX}
          placeholder={t.descriptionPlaceholder}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={`${id("description-hint")} ${id("description-error")}`}
        />
        <p id={id("description-hint")} className="mt-1 text-xs text-ink-3">
          {t.descriptionHint}
        </p>
        <FieldError id={id("description-error")} code={errors.description} />
      </div>

      <fieldset aria-describedby={`${id("ink-hint")} ${id("ink-error")}`}>
        <legend className="label mb-1">{t.ink}</legend>
        <p id={id("ink-hint")} className="mb-2 text-xs text-ink-3">
          {t.inkHint}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INK_KEYS.map((key) => (
            <label
              key={key}
              style={inkStyle(key)}
              className="flex cursor-pointer items-center gap-2 border-2 border-line bg-surface px-2 py-1.5 text-sm has-[:checked]:border-edge has-[:checked]:font-semibold has-[:checked]:shadow-hard-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input
                type="radio"
                name="ink"
                value={key}
                checked={ink === key}
                onChange={() => setInk(key)}
                className="sr-only"
              />
              <span aria-hidden className="size-4 shrink-0 border border-edge bg-shop" />
              <span className="truncate">{m.seller.inks[key]}</span>
            </label>
          ))}
        </div>
        <FieldError id={id("ink-error")} code={errors.ink} />
      </fieldset>

      <div>
        <p className="label mb-1">{t.preview}</p>
        <div className="card flex items-center gap-3 p-3" style={inkStyle(ink)}>
          <span className="squares p-1.5">
            <ShopSeal name={previewName} ink={ink} size={48} logoUrl={logoUrl} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-shop [font-stretch:75%]">{previewName}</p>
            <p className="text-sm text-ink-2">
              {m.product.soldBy} <span className="font-semibold text-shop">{previewName}</span>
            </p>
            <p className="num truncate text-xs text-ink-3">
              {t.slugPrefix}
              {slug || "…"}
            </p>
          </div>
        </div>
      </div>

      <SubmitButton className="btn btn-primary btn-block" pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
