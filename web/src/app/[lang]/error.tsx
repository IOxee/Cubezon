"use client";

import Link from "next/link";
import { useEffect } from "react";
import { fmt } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { ItemIcon } from "@/components/ui/item-icon";
import { Stamp } from "@/components/ui/stamp";

/** Route-level error boundary: generic message (no details in production) and a retry button. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const m = useMessages();
  const t = m.errors.generic;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
      <div className="card squares relative mb-4 flex size-40 items-center justify-center">
        <ItemIcon material="tnt" size={72} />
        <Stamp tone="danger" rotate={-6} className="absolute -right-8 -bottom-4 bg-surface">
          {m.catalog.errors.genericStamp}
        </Stamp>
      </div>
      <h1 className="text-2xl md:text-3xl">{t.title}</h1>
      <p className="text-ink-2">{t.body}</p>
      {error.digest ? (
        <p className="num text-xs text-ink-3">{fmt(m.catalog.errors.reference, { digest: error.digest })}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          {m.common.retry}
        </button>
        <Link href="/" className="btn">
          {m.errors.notFound.home}
        </Link>
      </div>
    </div>
  );
}
