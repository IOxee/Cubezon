import Link from "next/link";
import { getMessages } from "@/i18n/server";

/** Block header: mono label, title and an optional "see all" link. */
export async function SectionHeader({
  label,
  title,
  href,
  linkText,
}: {
  label?: string;
  title: string;
  href?: string;
  linkText?: string;
}) {
  const m = await getMessages();
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b-2 border-edge pb-2">
      <div>
        {label ? <p className="label">{label}</p> : null}
        <h2 className="text-xl">{title}</h2>
      </div>
      {href ? (
        <Link href={href} className="link text-sm font-semibold whitespace-nowrap">
          {linkText ?? m.common.seeAll}
        </Link>
      ) : null}
    </div>
  );
}
