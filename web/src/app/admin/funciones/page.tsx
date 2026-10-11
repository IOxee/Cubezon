import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/skeletons";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { getFeaturePanel, type FeaturePanel } from "@/lib/data/features";
import { FEATURE_GROUPS, FEATURES, type FeatureDef, type FeatureValue } from "@/lib/features";
import { formatAmount, formatDateTime } from "@/lib/format";
import { saveFeaturesAction } from "./actions";

export const metadata: Metadata = { title: m.admin.features.title };

const t = m.admin.features;

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
  const panel = await getFeaturePanel();
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <p className="mb-4 text-sm text-ink-2" role="status">
        {panel.publishedAt ? fmt(t.publishedAt, { date: formatDateTime(panel.publishedAt) }) : t.neverPublished}
      </p>
      <ActionForm action={saveFeaturesAction}>
        <div className="grid gap-4 lg:grid-cols-3">
          {FEATURE_GROUPS.map((group) => (
            <fieldset key={group} className="card-soft p-4">
              <legend className="label px-1">{t.groups[group]}</legend>
              <div className="mt-2 grid gap-5">
                {FEATURES.filter((def) => def.group === group).map((def) => (
                  <Field key={def.key} def={def} panel={panel} />
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

function shown(def: FeatureDef, value: FeatureValue | undefined): string {
  if (value === undefined) return t.unknown;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  return def.kind === "decimal" ? formatAmount(value) : String(value);
}

/** One option: a select (on / off / config.yml) or a number; empty goes back to config.yml. */
function Field({ def, panel }: { def: FeatureDef; panel: FeaturePanel }) {
  const text = t.options[def.key];
  const id = `feature-${def.key.replaceAll(".", "-")}`;
  const stored = panel.overrides[def.key] ?? "";
  return (
    <div>
      <label htmlFor={id} className="font-semibold">
        {text.label}
      </label>
      <p className="text-xs text-ink-2">{text.hint}</p>
      {def.kind === "boolean" ? (
        <select id={id} name={def.key} defaultValue={stored} className="input mt-1 w-full text-sm">
          <option value="">{t.fromFile}</option>
          <option value="true">{t.on}</option>
          <option value="false">{t.off}</option>
        </select>
      ) : (
        <input
          id={id}
          name={def.key}
          defaultValue={stored}
          inputMode={def.kind === "integer" ? "numeric" : "decimal"}
          autoComplete="off"
          placeholder={t.fromFile}
          className="input num mt-1 w-full text-sm"
        />
      )}
      <p className="mt-1 text-xs text-ink-3">
        {fmt(t.inForce, { value: shown(def, panel.inForce[def.key]) })}
        {stored ? ` · ${t.overridden}` : ""}
      </p>
      <code className="num block text-xs text-ink-3">{def.key}</code>
    </div>
  );
}
