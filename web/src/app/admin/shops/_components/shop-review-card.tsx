import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { CopyCommand } from "@/components/ui/copy-command";
import { ShopSeal } from "@/components/ui/shop-mark";
import { Stamp } from "@/components/ui/stamp";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m } from "@/i18n";
import { REVIEW_NOTE_MAX, decisionsFor, type AdminShop, type ShopDecision } from "@/lib/data/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { inkStyle } from "@/lib/inks";
import { shopMediaUrl } from "@/lib/shop-media";
import { reviewShopAction, setShopOfficialAction } from "../actions";

const t = m.admin.shops;

const DECISION_STYLE: Record<ShopDecision, string> = {
  approve: "btn btn-primary btn-sm",
  reject: "btn btn-danger btn-sm",
  suspend: "btn btn-danger btn-sm",
  reactivate: "btn btn-primary btn-sm",
};

/** One shop in the review list: who asked for it, what it says and the review actions. */
export function ShopReviewCard({ shop, canSetOfficial }: { shop: AdminShop; canSetOfficial: boolean }) {
  const noteId = `note-${shop.id}`;
  const decisions = decisionsFor(shop.status);

  return (
    <article className="card-soft grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]" style={inkStyle(shop.ink)}>
      <div className="grid min-w-0 content-start gap-3">
        <div className="flex items-start gap-3">
          <ShopSeal name={shop.name} ink={shop.ink} size={44} logoUrl={shopMediaUrl(shop.logoPath)} />
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg">
              <span className="text-shop">{shop.name}</span>
              {shop.official ? (
                <Stamp tone="shop" size="sm" rotate={-2}>
                  {m.common.officialStamp}
                </Stamp>
              ) : null}
            </h2>
            <p className="num text-xs text-ink-3">/t/{shop.slug}</p>
          </div>
          <span className="badge badge-paper ml-auto">{m.status.shop[shop.status]}</span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="label self-center">{t.owner}</dt>
          <dd className="font-semibold">{shop.ownerName}</dd>
          <dt className="label self-center">{t.requested}</dt>
          <dd className="num">{formatDate(shop.createdAt)}</dd>
          {shop.reviewedAt ? (
            <>
              <dt className="label self-center">{t.reviewed}</dt>
              <dd className="num">
                {shop.reviewerName
                  ? fmt(t.reviewedBy, { date: formatDateTime(shop.reviewedAt), name: shop.reviewerName })
                  : formatDateTime(shop.reviewedAt)}
              </dd>
            </>
          ) : null}
          <dt className="label self-center">{t.zone}</dt>
          <dd className={shop.zone ? "num" : "text-danger"}>
            {shop.zone
              ? fmt(t.zoneValue, {
                  world: m.worlds[shop.zone.world as keyof typeof m.worlds] ?? shop.zone.world,
                  min: shop.zone.min.join(", "),
                  max: shop.zone.max.join(", "),
                })
              : t.noZone}
          </dd>
          <dt className="label self-center">{t.storage}</dt>
          <dd className="num">{fmt(t.storageValue, shop.storage)}</dd>
        </dl>

        <div className="grid gap-1">
          <CopyCommand command={fmt(m.commands.shopZone, { slug: shop.slug })} />
          <p className="text-xs text-ink-3">{t.zoneHelp}</p>
        </div>

        <p className={`text-sm whitespace-pre-line ${shop.description ? "" : "text-ink-3"}`}>
          {shop.description || t.noDescription}
        </p>

        {shop.reviewNote ? (
          <div className="border-l-4 border-edge bg-paper px-3 py-2 text-sm">
            <p className="label">{t.reviewNote}</p>
            <p className="whitespace-pre-line">{shop.reviewNote}</p>
          </div>
        ) : null}

        {shop.status === "APPROVED" ? (
          <Link href={`/t/${shop.slug}`} className="link text-sm font-semibold">
            {t.viewShop}
          </Link>
        ) : null}
      </div>

      <div className="grid content-start gap-3 border-t border-line pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
        {decisions.length > 0 ? (
          <ActionForm action={reviewShopAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="shopId" value={shop.id} />
            <div className="basis-full">
              <label htmlFor={noteId} className="label">
                {t.note.label}
              </label>
              <textarea
                id={noteId}
                name="note"
                rows={3}
                maxLength={REVIEW_NOTE_MAX}
                placeholder={t.note.placeholder}
                aria-describedby={`${noteId}-hint`}
                className="input mt-1 min-h-0 text-sm"
              />
              <p id={`${noteId}-hint`} className="mt-1 text-xs text-ink-3">
                {fmt(t.note.hint, { max: REVIEW_NOTE_MAX })}
              </p>
            </div>
            {decisions.map((decision) => (
              <SubmitButton
                key={decision}
                name="decision"
                value={decision}
                className={DECISION_STYLE[decision]}
                pendingLabel={t.saving}
              >
                {t.decisions[decision]}
              </SubmitButton>
            ))}
          </ActionForm>
        ) : null}

        {canSetOfficial ? (
          <ActionForm action={setShopOfficialAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="shopId" value={shop.id} />
            <input type="hidden" name="official" value={shop.official ? "false" : "true"} />
            <span className="label grow">{t.official.label}</span>
            <SubmitButton className="btn btn-sm" pendingLabel={t.saving}>
              {shop.official ? t.official.off : t.official.on}
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
    </article>
  );
}
