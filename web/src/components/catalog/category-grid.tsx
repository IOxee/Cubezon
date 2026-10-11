import Link from "next/link";
import { m } from "@/i18n";
import { CATEGORY_ICON, CATEGORY_KEYS } from "@/lib/categories";
import { ItemIcon } from "@/components/ui/item-icon";
import { keySlug } from "@/lib/url-slug";

/** Category mosaic: one coupon per category, linking to the filtered search. */
export function CategoryGrid() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {CATEGORY_KEYS.map((key) => {
        const category = m.categories[key];
        return (
          <li key={key}>
            <Link href={`/search?category=${keySlug(key)}`} className="lift card flex h-full items-center gap-3 p-2.5">
              <span className="squares flex shrink-0 items-center justify-center border border-line p-1.5">
                <ItemIcon material={CATEGORY_ICON[key]} size={32} />
              </span>
              <span className="min-w-0">
                <span className="block leading-tight font-semibold">{category.name}</span>
                <span className="block text-xs text-ink-3">{category.blurb}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
