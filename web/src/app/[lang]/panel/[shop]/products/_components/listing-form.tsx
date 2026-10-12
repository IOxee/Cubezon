"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { fmt } from "@/i18n";
import { useFormat, useLocale, useMessages } from "@/i18n/client";
import { itemName, knownItemNames } from "@/i18n/items";
import {
  charLength,
  EDITABLE_LISTING_STATUSES,
  idleState,
  isValidMaterial,
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE,
  MATERIAL_MAX,
  maxUnitAmount,
  normalizeMaterial,
  parsePriceCents,
  parseUnitAmount,
  priceInputValue,
  UNIT_AMOUNT,
  type EditableListingStatus,
  type FormState,
  type ListingField,
} from "@/lib/seller/validation";
import { FieldError, FormFeedback } from "@/components/seller/form-feedback";
import { ItemIcon } from "@/components/ui/item-icon";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";

export type ListingFormValues = {
  id: string;
  title: string;
  description: string;
  material: string;
  /** Value of the item field: the vanilla id, or the key of a custom item. */
  item: string;
  unitAmount: number;
  unitPrice: number;
  status: EditableListingStatus;
};

/**
 * New / edit listing form of one shop (its slug is bound to the action). Material and items per
 * unit are locked once anything was deposited.
 */
export function ListingForm({
  action,
  listing,
  formatLocked = false,
  backHref,
}: {
  action: (state: FormState<ListingField>, formData: FormData) => Promise<FormState<ListingField>>;
  listing?: ListingFormValues;
  formatLocked?: boolean;
  /** Listings page of the shop (the "back" link). */
  backHref: string;
}) {
  const m = useMessages();
  const f = useFormat();
  const locale = useLocale();
  const t = m.seller.listingForm;
  const itemNames = knownItemNames(locale);
  // Known item ids for the material suggestions, sorted by name in the page's language.
  const suggestions = useMemo(
    () => Object.entries(knownItemNames(locale)).sort(([, a], [, b]) => a.localeCompare(b, locale)),
    [locale],
  );
  const [state, formAction] = useActionState(action, idleState<ListingField>());
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [material, setMaterial] = useState(listing?.item ?? "");
  const [preview, setPreview] = useState(listing?.material ?? "");
  const [unitAmount, setUnitAmount] = useState(String(listing?.unitAmount ?? 1));
  const [unitPrice, setUnitPrice] = useState(listing ? priceInputValue(listing.unitPrice, locale) : "");
  const [status, setStatus] = useState<EditableListingStatus>(listing?.status ?? "ACTIVE");
  const errors = state.fieldErrors;

  const materialId = normalizeMaterial(material);
  // A unit is one ItemStack: tools stack to 1, pearls and signs to 16, the rest to 64.
  const maxAmount = isValidMaterial(materialId) ? maxUnitAmount(materialId) : UNIT_AMOUNT.max;
  const amount = parseUnitAmount(unitAmount);
  const price = parsePriceCents(unitPrice, locale);
  const perItem = amount && amount > 1 && "cents" in price ? f.money(price.cents / 100 / amount) : null;

  return (
    <form action={formAction} className="space-y-5">
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}
      <FormFeedback state={state} />

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor="listing-title" className="label">
            {t.title}
          </label>
          <span className="num text-xs text-ink-3" aria-hidden>
            {fmt(m.seller.shopForm.counter, { count: charLength(title), max: LISTING_TITLE.max })}
          </span>
        </div>
        <input
          id="listing-title"
          name="title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={LISTING_TITLE.min}
          maxLength={LISTING_TITLE.max}
          placeholder={t.titlePlaceholder}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby="listing-title-hint listing-title-error"
        />
        <p id="listing-title-hint" className="mt-1 text-xs text-ink-3">
          {t.titleHint}
        </p>
        <FieldError id="listing-title-error" code={errors.title} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor="listing-description" className="label">
            {t.description}
          </label>
          <span className="num text-xs text-ink-3" aria-hidden>
            {fmt(m.seller.shopForm.counter, { count: charLength(description), max: LISTING_DESCRIPTION_MAX })}
          </span>
        </div>
        <textarea
          id="listing-description"
          name="description"
          className="input"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={LISTING_DESCRIPTION_MAX}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby="listing-description-hint listing-description-error"
        />
        <p id="listing-description-hint" className="mt-1 text-xs text-ink-3">
          {t.descriptionHint}
        </p>
        <FieldError id="listing-description-error" code={errors.description} />
      </div>

      {formatLocked ? <Notice>{t.locked}</Notice> : null}

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="listing-material" className="label mb-1 block">
            {t.material}
          </label>
          <input
            id="listing-material"
            name="item"
            className="input num"
            list="listing-material-options"
            value={material}
            onChange={(event) => {
              setMaterial(event.target.value);
              const id = normalizeMaterial(event.target.value);
              // Only fetch the icon for complete ids (picked from the list), or on blur.
              if (Object.hasOwn(itemNames, id)) setPreview(id);
            }}
            onBlur={() => setPreview(normalizeMaterial(material))}
            required
            maxLength={MATERIAL_MAX + 10}
            placeholder={t.materialPlaceholder}
            autoComplete="off"
            spellCheck={false}
            disabled={formatLocked}
            aria-invalid={errors.item ? true : undefined}
            aria-describedby="listing-material-hint listing-material-error"
          />
          <datalist id="listing-material-options">
            {suggestions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </datalist>
          <p id="listing-material-hint" className="mt-1 text-xs text-ink-3">
            {t.materialHint}
          </p>
          <FieldError id="listing-material-error" code={errors.item} />
        </div>
        <figure aria-label={t.materialPreview} className="flex items-center gap-3 sm:w-56">
          <span className="squares flex size-16 shrink-0 items-center justify-center border-2 border-edge">
            {isValidMaterial(preview) ? <ItemIcon key={preview} material={preview} size={48} /> : null}
          </span>
          <figcaption className="min-w-0 text-sm">
            {isValidMaterial(preview) ? (
              <>
                <span className="block font-semibold">{itemName(preview, locale)}</span>
                <span className="num block truncate text-xs text-ink-3">{preview}</span>
              </>
            ) : (
              <span className="text-ink-3">{t.materialPreviewEmpty}</span>
            )}
          </figcaption>
        </figure>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="listing-unit-amount" className="label mb-1 block">
            {t.unitAmount}
          </label>
          <input
            id="listing-unit-amount"
            name="unitAmount"
            type="number"
            inputMode="numeric"
            className="input num"
            value={unitAmount}
            onChange={(event) => setUnitAmount(event.target.value)}
            required
            min={UNIT_AMOUNT.min}
            max={maxAmount}
            step={1}
            disabled={formatLocked}
            aria-invalid={errors.unitAmount ? true : undefined}
            aria-describedby="listing-unit-amount-hint listing-unit-amount-error"
          />
          <p id="listing-unit-amount-hint" className="mt-1 text-xs text-ink-3">
            {maxAmount < UNIT_AMOUNT.max ? fmt(t.unitAmountHintStack, { max: maxAmount }) : t.unitAmountHint}
          </p>
          <FieldError id="listing-unit-amount-error" code={errors.unitAmount} values={{ max: maxAmount }} />
        </div>

        <div>
          <label htmlFor="listing-unit-price" className="label mb-1 block">
            {t.unitPrice}
          </label>
          <div className="flex">
            <input
              id="listing-unit-price"
              name="unitPrice"
              className="input num min-w-0 flex-1 text-right"
              inputMode="decimal"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              required
              maxLength={20}
              placeholder={t.unitPricePlaceholder}
              autoComplete="off"
              aria-invalid={errors.unitPrice ? true : undefined}
              aria-describedby="listing-unit-price-hint listing-unit-price-error"
            />
            <span aria-hidden className="num flex items-center border-2 border-l-0 border-edge bg-paper px-3 text-ink-2">
              {m.money.suffix.trim()}
            </span>
          </div>
          <p id="listing-unit-price-hint" className="mt-1 text-xs text-ink-3">
            {perItem ? fmt(t.perItem, { price: perItem }) : t.unitPriceHint}
          </p>
          <FieldError id="listing-unit-price-error" code={errors.unitPrice} />
        </div>
      </div>

      <fieldset aria-describedby="listing-status-error">
        <legend className="label mb-2">{t.status}</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {EDITABLE_LISTING_STATUSES.map((value) => (
            <label
              key={value}
              className="flex flex-1 cursor-pointer items-center gap-2 border-2 border-line bg-surface px-3 py-2 text-sm has-[:checked]:border-edge has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="accent-[var(--ink)]"
              />
              {t.statusOptions[value]}
            </label>
          ))}
        </div>
        <FieldError id="listing-status-error" code={errors.status} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-edge pt-4">
        <SubmitButton pendingLabel={listing ? t.saving : t.creating}>{listing ? t.save : t.create}</SubmitButton>
        <Link href={backHref} className="btn btn-ghost">
          {t.back}
        </Link>
      </div>
    </form>
  );
}
