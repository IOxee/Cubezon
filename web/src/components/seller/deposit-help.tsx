import { fmt, m } from "@/i18n";
import { itemName } from "@/i18n/items.es";
import { Notice } from "@/components/ui/notice";
import { CommandText } from "./command-text";

/**
 * How to put stock into a listing (active or paused) with /cz deposit, for one listing when
 * given its format. Deposits also need room in the storage blocks of the shop zone.
 */
export function DepositHelp({
  material,
  unitAmount,
  approved,
}: {
  material?: string;
  unitAmount?: number;
  approved: boolean;
}) {
  const t = m.seller.deposit;
  const steps = [
    t.join,
    t.command,
    material && unitAmount ? fmt(t.stack, { amount: unitAmount, item: itemName(material) }) : t.stackAny,
    t.appears,
  ];
  return (
    <section aria-labelledby="deposit-help" className="card-soft p-4">
      <h2 id="deposit-help" className="mb-3 text-lg">
        {t.title}
      </h2>
      <ol className="space-y-2 text-sm">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="num flex size-6 shrink-0 items-center justify-center border-2 border-edge text-xs font-semibold">
              {index + 1}
            </span>
            <span className="pt-0.5">
              <CommandText text={step} command={m.commands.deposit} />
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-3">{t.note}</p>
      <p className="mt-2 text-xs text-ink-3">
        <CommandText text={t.storage} command={m.seller.commands.storage} />
      </p>
      {approved ? null : <Notice className="mt-3">{t.notApproved}</Notice>}
    </section>
  );
}
