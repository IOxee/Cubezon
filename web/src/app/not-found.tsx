import Link from "next/link";
import { m } from "@/i18n";
import { ItemIcon } from "@/components/ui/item-icon";
import { Stamp } from "@/components/ui/stamp";

export default function NotFound() {
  const t = m.errors.notFound;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
      <div className="card squares relative mb-4 flex size-40 items-center justify-center">
        <ItemIcon material="lava_bucket" size={72} />
        <Stamp tone="danger" rotate={-8} className="absolute -right-8 -bottom-4 bg-surface">
          {m.catalog.errors.notFoundStamp}
        </Stamp>
      </div>
      <h1 className="text-2xl md:text-3xl">{t.title}</h1>
      <p className="text-ink-2">{t.body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          {t.home}
        </Link>
        <Link href="/search" className="btn">
          {m.nav.all}
        </Link>
      </div>
    </div>
  );
}
