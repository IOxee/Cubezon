"use client";

import { useActionState, useState } from "react";
import { fmt } from "@/i18n";
import { useFormat, useMessages } from "@/i18n/client";
import { MAX_FEATURED_LISTINGS, SHOP_TAGLINE_MAX, type ProfileField } from "@/lib/seller/profile";
import { charLength, idleState, type FormState } from "@/lib/seller/validation";
import { ItemIcon } from "@/components/ui/item-icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormFeedback } from "./form-feedback";

/** An ACTIVE listing the seller can feature (only the fields the form shows). */
export type FeaturedOption = { id: string; title: string; material: string; available: number };

export type ShopProfileValues = { tagline: string; featuredListingIds: string[]; showLocation: boolean };

/**
 * Public profile of a shop: tagline, up to four featured listings (checkboxes; once four are
 * ticked the rest are disabled) and whether the storefront shows the shop's zone. The server
 * validates everything again and drops listings that are no longer active.
 */
export function ShopProfileForm({
  action,
  initial,
  options,
  hasZone,
}: {
  action: (state: FormState<ProfileField>, formData: FormData) => Promise<FormState<ProfileField>>;
  initial: ShopProfileValues;
  options: FeaturedOption[];
  hasZone: boolean;
}) {
  const m = useMessages();
  const f = useFormat();
  const t = m.seller.profile;
  const [state, formAction] = useActionState(action, idleState<ProfileField>());
  const [tagline, setTagline] = useState(initial.tagline);
  const [featured, setFeatured] = useState(() =>
    initial.featuredListingIds.filter((id) => options.some((option) => option.id === id)),
  );
  const [showLocation, setShowLocation] = useState(initial.showLocation);
  const errors = state.fieldErrors;
  const full = featured.length >= MAX_FEATURED_LISTINGS;

  function toggle(id: string, checked: boolean) {
    setFeatured((current) => (checked ? [...current.filter((other) => other !== id), id] : current.filter((other) => other !== id)));
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} savedMessage={t.saved} />

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor="profile-tagline" className="label">
            {t.tagline}
          </label>
          <span className="num text-xs text-ink-3" aria-hidden>
            {fmt(m.seller.shopForm.counter, { count: charLength(tagline), max: SHOP_TAGLINE_MAX })}
          </span>
        </div>
        <input
          id="profile-tagline"
          name="tagline"
          className="input"
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          maxLength={SHOP_TAGLINE_MAX}
          placeholder={t.taglinePlaceholder}
          autoComplete="off"
          aria-invalid={errors.tagline ? true : undefined}
          aria-describedby="profile-tagline-hint profile-tagline-error"
        />
        <p id="profile-tagline-hint" className="mt-1 text-xs text-ink-3">
          {t.taglineHint}
        </p>
        <FieldError id="profile-tagline-error" code={errors.tagline} />
      </div>

      <fieldset aria-describedby="profile-featured-hint profile-featured-error">
        <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
          <span className="label">{t.featured}</span>
          <span className="num text-xs text-ink-3" aria-hidden>
            {fmt(t.featuredCount, { count: featured.length, max: MAX_FEATURED_LISTINGS })}
          </span>
        </legend>
        <p id="profile-featured-hint" className="mb-2 text-xs text-ink-3">
          {fmt(t.featuredHint, { max: MAX_FEATURED_LISTINGS })}
        </p>
        {options.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => {
              const checked = featured.includes(option.id);
              return (
                <li key={option.id}>
                  <label className="flex cursor-pointer items-center gap-3 border-2 border-line bg-surface px-2 py-1.5 text-sm has-[:checked]:border-edge has-[:checked]:shadow-hard-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                    <input
                      type="checkbox"
                      name="featured"
                      value={option.id}
                      checked={checked}
                      disabled={full && !checked}
                      onChange={(event) => toggle(option.id, event.target.checked)}
                      className="accent-ink"
                    />
                    <span className="squares flex size-9 shrink-0 items-center justify-center">
                      <ItemIcon material={option.material} size={24} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate ${checked ? "font-semibold" : ""}`}>{option.title}</span>
                      <span className="num block text-xs text-ink-3">
                        {fmt(t.featuredStock, { count: f.integer(option.available) })}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-2 border-dashed border-line px-3 py-2 text-sm text-ink-2">{t.featuredEmpty}</p>
        )}
        <p className="mt-2 text-xs text-ink-3">{t.featuredNote}</p>
        <FieldError id="profile-featured-error" code={errors.featured} />
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="showLocation"
            checked={showLocation}
            onChange={(event) => setShowLocation(event.target.checked)}
            className="mt-1 accent-ink"
            aria-describedby="profile-location-hint"
          />
          {t.location}
        </label>
        <p id="profile-location-hint" className="mt-1 ml-6 text-xs text-ink-3">
          {t.locationHint} {hasZone ? null : <span className="text-ink-2">{t.locationNoZone}</span>}
        </p>
      </div>

      <SubmitButton className="btn btn-primary btn-block" pendingLabel={t.saving}>
        {t.save}
      </SubmitButton>
    </form>
  );
}
