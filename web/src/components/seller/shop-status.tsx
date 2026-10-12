"use client";

import { useMessages } from "@/i18n/client";
import type { ListingStatus, ShopStatus } from "@/lib/seller/stats";
import { Stamp } from "@/components/ui/stamp";

const SHOP_TONE = {
  PENDING: "muted",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
} as const;

/** Shop status as a crooked stamp ("EN REVISIÓN", "APROBADA"…). */
export function ShopStatusStamp({ status, size = "sm" }: { status: ShopStatus; size?: "sm" | "md" | "lg" }) {
  const m = useMessages();
  return (
    <Stamp tone={SHOP_TONE[status]} size={size} rotate={status === "APPROVED" ? -5 : -3}>
      {m.status.shop[status]}
    </Stamp>
  );
}

const LISTING_BADGE = {
  ACTIVE: "badge badge-ink",
  PAUSED: "badge badge-paper",
  REMOVED: "badge badge-paper border-dashed text-ink-3",
} as const;

/** Listing status as a small badge (tables are dense: stamps are kept for orders). */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const m = useMessages();
  return <span className={LISTING_BADGE[status]}>{m.status.listing[status]}</span>;
}
