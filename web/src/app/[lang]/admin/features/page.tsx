import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, type Messages } from "@/i18n";
import { getFormat, getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/auth/session";
import { getFeaturePanel, type FeaturePanel } from "@/lib/data/features";
import { FEATURE_GROUPS, FEATURES, isFeaturePending, type FeatureDef, type FeatureValue } from "@/lib/features";
import type { Format } from "@/lib/format";
import { saveFeaturesAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.admin.features.title };
}

/** Superadmin only: the plugin options the server owner can change without touching config.yml. */
export default function AdminFeaturesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Features />
    </Suspense>
  );
}

async function Features() {
  await requireStaff("SUPERADMIN");
  const [panel, m, f] = await Promise.all([getFeaturePanel(), getMessages(), getFormat()]);
  const t = m.admin.features;
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <p className="mb-4 text-sm text-ink-2" role="status">
        {panel.publishedAt ? fmt(t.publishedAt, { date: f.dateTime(panel.publishedAt) }) : t.neverPublished}
      </p>
      <ActionForm action={saveFeaturesAction}>
        <div className="grid gap-4 lg:grid-cols-3">
          {FEATURE_GROUPS.map((group) => (
            <fieldset key={group} className="card-soft p-4">
              <legend className="label px-1">{t.groups[group]}</legend>
              <div className="mt-2 grid gap-4">
                {FEATURES.filter((def) => def.group === group).map((def) => (
                  <Field key={def.key} def={def} panel={panel} m={m} f={f} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-4">
          <SubmitButton pendingLabel={t.saving}>{t.save}</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}

function shown(m: Messages, f: Format, def: FeatureDef, value: FeatureValue): string {
  const t = m.admin.features;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (typeof value === "string") return choiceLabel(m, value);
  return def.kind === "decimal" ? f.amount(value) : String(value);
}

function choiceLabel(m: Messages, value: string): string {
  const t = m.admin.features;
  return value in t.choices ? t.choices[value as keyof typeof t.choices] : value;
}

/** The radio options of a boolean or choice field: the default (config.yml) first. */
function radioOptions(m: Messages, def: FeatureDef, defaultLabel: string): (readonly [string, string])[] {
  const t = m.admin.features;
  const values: (readonly [string, string])[] =
    def.kind === "boolean"
      ? [
          ["true", t.on],
          ["false", t.off],
        ]
      : (def.choices ?? []).map((choice) => [choice, choiceLabel(m, choice)] as const);
  return [["", defaultLabel], ...values];
}

/**
 * One option. While it is not overridden, what is in force is config.yml's value, so the "default"
 * choice shows it. The controls are keyed by the stored value: after saving, React resets the form
 * and a mounted control would keep its old default; a new key mounts it with the saved one.
 */
function Field({ def, panel, m, f }: { def: FeatureDef; panel: FeaturePanel; m: Messages; f: Format }) {
  const t = m.admin.features;
  const text = t.options[def.key];
  const id = `feature-${def.key.replaceAll(".", "-")}`;
  const stored = panel.overrides[def.key];
  const inForce = panel.inForce[def.key];
  const pending = isFeaturePending(stored, inForce);
  const defaultLabel = stored === undefined && inForce !== undefined ? fmt(t.byDefaultValue, { value: shown(m, f, def, inForce) }) : t.byDefault;
  return (
    <div className="grid gap-2 border-t-2 border-dashed border-line pt-4 first:border-t-0 first:pt-0" title={def.key}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p id={`${id}-label`} className="font-semibold">
            {text.label}
          </p>
          <p id={`${id}-hint`} className="text-xs text-ink-2">
            {text.hint}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {stored !== undefined ? <span className="badge badge-ink">{t.overridden}</span> : null}
          {pending ? (
            <span className="badge badge-accent" title={t.pendingHint}>
              {t.pending}
            </span>
          ) : null}
        </div>
      </div>
      {def.kind === "boolean" || def.kind === "choice" ? (
        <div
          key={`${def.key}:${stored ?? ""}`}
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          className={`grid border-2 border-edge bg-surface text-sm ${def.kind === "boolean" ? "grid-cols-3" : "grid-cols-1"}`}
        >
          {radioOptions(m, def, defaultLabel).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center px-2 py-1.5 text-center leading-tight font-semibold has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                def.kind === "boolean" ? "not-first:border-l-2 not-first:border-edge" : "not-first:border-t-2 not-first:border-edge"
              }`}
            >
              <input type="radio" name={def.key} value={value} defaultChecked={(stored ?? "") === value} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      ) : (
        <input
          key={`${def.key}:${stored ?? ""}`}
          id={id}
          name={def.key}
          defaultValue={stored ?? ""}
          inputMode={def.kind === "integer" ? "numeric" : "decimal"}
          autoComplete="off"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          placeholder={defaultLabel}
          className="input num w-full text-sm"
        />
      )}
      {pending && inForce !== undefined ? (
        <p className="text-xs text-ink-3">{fmt(t.inForce, { value: shown(m, f, def, inForce) })}</p>
      ) : null}
    </div>
  );
}
