import Link from "next/link";
import type { ReactNode } from "react";
import { fmt, plural } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { inkStyle } from "@/lib/inks";
import { ItemIcon } from "@/components/ui/item-icon";
import { SoldBy } from "@/components/ui/shop-mark";

export type LineListing = {
  id: string;
  title: string;
  material: string;
  unitAmount: number;
  shop: { name: string; slug: string; ink: string; official?: boolean };
};

/** Icon on ruled squares, title, "sold by" and items per unit; extra content goes below. */
export async function LineItemInfo({
  listing,
  href = `/p/${listing.id}`,
  iconSize = 48,
  children,
}: {
  listing: LineListing;
  href?: string | null;
  iconSize?: number;
  children?: ReactNode;
}) {
  const m = await getMessages();
  return (
    <div className="flex min-w-0 gap-3" style={inkStyle(listing.shop.ink)}>
      <span className="squares relative flex shrink-0 items-center justify-center border border-line p-2">
        <ItemIcon material={listing.material} size={iconSize} />
        {listing.unitAmount > 1 ? (
          <span className="badge badge-paper absolute -right-1.5 -bottom-1.5">
            {fmt(m.product.unitShort, { count: listing.unitAmount })}
          </span>
        ) : null}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-base leading-snug font-semibold [font-stretch:100%]">
          {href ? (
            <Link href={href} className="hover:underline">
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h3>
        <SoldBy
          name={listing.shop.name}
          slug={listing.shop.slug}
          ink={listing.shop.ink}
          official={listing.shop.official ?? false}
        />
        <p className="text-xs text-ink-3">{plural(listing.unitAmount, m.product.unit)}</p>
        {children}
      </div>
    </div>
  );
}
