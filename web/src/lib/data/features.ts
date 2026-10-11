import "server-only";

import { isFeatureKey, parsePublishedFeatures, type FeatureChange, type FeatureKey, type FeatureValues } from "@/lib/features";
import { adminDb, dbError } from "@/lib/supabase/server";

/**
 * The server owner's feature panel. Overrides live in feature_settings (secret key only); what the
 * plugin has in force comes back published in plugin_settings.features on its next refresh.
 */

export type FeaturePanel = {
  /** Text stored per overridden option. */
  overrides: Partial<Record<FeatureKey, string>>;
  /** What the plugin applies now (config.yml plus overrides), as it last published it. */
  inForce: FeatureValues;
  /** When the plugin last published them; null if it never did (old plugin or no database). */
  publishedAt: string | null;
};

export async function getFeaturePanel(): Promise<FeaturePanel> {
  const db = adminDb();
  const [overrides, published] = await Promise.all([
    db.from("feature_settings").select("key, value"),
    db.from("plugin_settings").select("value, updated_at").eq("key", "features").maybeSingle(),
  ]);
  if (overrides.error) throw dbError(overrides.error);
  if (published.error) throw dbError(published.error);
  const stored: Partial<Record<FeatureKey, string>> = {};
  for (const row of overrides.data) {
    if (isFeatureKey(row.key)) stored[row.key] = row.value;
  }
  return {
    overrides: stored,
    inForce: parsePublishedFeatures(published.data?.value),
    publishedAt: published.data?.updated_at ?? null,
  };
}

/** Applies the panel: values are upserted, nulls delete the override (back to config.yml). */
export async function saveFeatureSettings(changes: readonly FeatureChange[], updatedBy: string): Promise<void> {
  const db = adminDb();
  const upserts = changes.flatMap((change) =>
    change.value === null ? [] : [{ key: change.key, value: change.value, updated_by: updatedBy, updated_at: new Date().toISOString() }],
  );
  const resets = changes.filter((change) => change.value === null).map((change) => change.key);
  if (upserts.length > 0) {
    const { error } = await db.from("feature_settings").upsert(upserts, { onConflict: "key" });
    if (error) throw dbError(error);
  }
  if (resets.length > 0) {
    const { error } = await db.from("feature_settings").delete().in("key", resets);
    if (error) throw dbError(error);
  }
}
