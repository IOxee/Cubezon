import { getMessages } from "@/i18n/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { restoreListingAction } from "../actions";

/** "Recuperar" for a removed listing: it comes back paused, so it can be sold again. */
export async function RestoreAction({ shopSlug, id, className = "btn btn-sm" }: { shopSlug: string; id: string; className?: string }) {
  const m = await getMessages();
  return (
    <form action={restoreListingAction.bind(null, shopSlug)} className="flex justify-end">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className={className} pendingLabel={m.seller.listings.restoring}>
        {m.seller.listings.restore}
      </SubmitButton>
    </form>
  );
}
