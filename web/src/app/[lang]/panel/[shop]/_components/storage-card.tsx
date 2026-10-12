import { fmt, plural } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { storageFillPercent, storageState, type ShopZone, type StorageFigures } from "@/lib/seller/storage";
import { CommandText } from "@/components/seller/command-text";
import { Notice } from "@/components/ui/notice";

/**
 * "Almacén" block of the overview: units in escrow against the capacity of the storage blocks
 * placed in the shop zone, and what the seller must do when they cannot deposit.
 */
export async function StorageCard({ zone, storage }: { zone: ShopZone | null; storage: StorageFigures }) {
  const [m, f] = await Promise.all([getMessages(), getFormat()]);
  const t = m.seller.storage;
  const state = storageState(zone, storage);
  const percent = storageFillPercent(storage);
  const overCapacity = storage.used >= storage.capacity && storage.used > 0;

  return (
    <section aria-labelledby="panel-storage" className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="panel-storage" className="text-lg">
          {t.title}
        </h2>
        <span className="num text-sm font-semibold">
          {f.integer(storage.used)}/{f.integer(storage.capacity)}
        </span>
      </div>

      <div
        role="meter"
        aria-label={t.meterLabel}
        aria-valuemin={0}
        aria-valuemax={Math.max(storage.capacity, storage.used)}
        aria-valuenow={storage.used}
        aria-valuetext={fmt(t.usage, { used: f.integer(storage.used), capacity: f.integer(storage.capacity) })}
        className="mt-2 h-3 border-2 border-edge bg-paper"
      >
        <div className={`h-full ${overCapacity ? "bg-danger" : "bg-ink"}`} style={{ width: `${percent}%` }} />
      </div>

      <p className="mt-2 text-xs text-ink-3">
        {fmt(t.usage, { used: f.integer(storage.used), capacity: f.integer(storage.capacity) })}
        {" · "}
        {plural(storage.blocks, t.blocks)}
      </p>
      <p className="mt-1 text-xs text-ink-3">{t.usageHint}</p>

      {state === "noZone" ? <Notice className="mt-3">{t.noZone}</Notice> : null}
      {state === "noBlocks" ? (
        <Notice className="mt-3">
          <CommandText text={t.noBlocks} command={m.seller.commands.storageBuy} />
        </Notice>
      ) : null}
      {state === "full" ? (
        <Notice tone="danger" className="mt-3">
          {t.full}
        </Notice>
      ) : null}

      <p className="mt-3 text-xs text-ink-3">
        {state === "ok" || state === "full" ? (
          <>
            <CommandText text={t.more} command={m.seller.commands.storageBuy} />{" "}
          </>
        ) : null}
        <CommandText text={t.check} command={m.seller.commands.storage} />
      </p>
    </section>
  );
}
