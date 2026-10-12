import { fmt } from "@/i18n";
import { getMessages } from "@/i18n/server";
import { listingPhotoUrl } from "@/lib/listing-photos";
import { ItemIcon } from "@/components/ui/item-icon";

/**
 * What a product looks like in the catalog: the shop's photo, filling its (relative) parent, or
 * the item icon when there is none. The badges and stamps of the card go on top of it.
 */
export async function ListingVisual({
  item,
  iconSize,
  iconAlt,
}: {
  item: { title: string; material: string; photoPath: string | null };
  iconSize: number;
  iconAlt?: string;
}) {
  const photo = listingPhotoUrl(item.photoPath);
  if (!photo) return <ItemIcon material={item.material} size={iconSize} alt={iconAlt} />;
  const m = await getMessages();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user image from the public bucket
    <img
      src={photo}
      alt={fmt(m.catalog.media.photoAlt, { title: item.title })}
      className="absolute inset-0 size-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
}
