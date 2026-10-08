import Link from "next/link";
import { fmt, m } from "@/i18n";
import { inkStyle } from "@/lib/inks";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/**
 * Shop seal: the shop's logo cropped to the square, or its initials, inside a double square in
 * the shop's ink. logoUrl comes from shopMediaUrl(logo_path); without it, the initials.
 */
export function ShopSeal({
  name,
  ink,
  size = 40,
  logoUrl = null,
}: {
  name: string;
  ink: string;
  size?: number;
  logoUrl?: string | null;
}) {
  const frame = "inline-flex shrink-0 border-2 border-shop outline-1 outline-offset-2 outline-shop";
  if (logoUrl) {
    return (
      <span
        className={`${frame} overflow-hidden bg-surface`}
        style={{ ...inkStyle(ink), width: size, height: size, outlineStyle: "solid" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user image from the public Storage bucket */}
        <img
          src={logoUrl}
          alt={fmt(m.catalog.media.logoAlt, { name })}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={fmt(m.a11y.shopSeal, { name })}
      className={`${frame} items-center justify-center font-pixel font-bold text-shop`}
      style={{ ...inkStyle(ink), width: size, height: size, fontSize: size * 0.4, outlineStyle: "solid" }}
    >
      {initials(name)}
    </span>
  );
}

/** "Vendido por <shop>" link in the shop's ink. */
export function SoldBy({
  name,
  slug,
  ink,
  official = false,
}: {
  name: string;
  slug: string;
  ink: string;
  official?: boolean;
}) {
  return (
    <span className="text-sm text-ink-2" style={inkStyle(ink)}>
      {m.product.soldBy}{" "}
      <Link href={`/t/${slug}`} className="link font-semibold text-shop">
        {name}
      </Link>
      {official ? <span className="badge badge-ink ml-1.5">{m.common.officialStamp}</span> : null}
    </span>
  );
}
