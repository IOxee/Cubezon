"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/components/admin/action-form";
import { fmt, m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { getFeaturePanel, saveFeatureSettings } from "@/lib/data/features";
import { parseFeatureForm } from "@/lib/features";

const t = m.admin.features;

function fail(message: string): ActionState {
  return { status: "error", message };
}

/**
 * Saves the whole feature panel: each option is overridden or (empty field) sent back to config.yml.
 * The plugin validates again and applies it on its next refresh. Superadmin only.
 */
export async function saveFeaturesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const player = await requireStaff("SUPERADMIN");

  const { inForce } = await getFeaturePanel();
  const result = parseFeatureForm((name) => formData.get(name), inForce);
  if (!result.ok) {
    if (result.invalid.length === 0) return fail(t.errors.delays);
    return fail(fmt(t.errors.invalid, { fields: result.invalid.map((key) => t.options[key].label).join(", ") }));
  }

  await saveFeatureSettings(result.changes, player.uuid);
  refresh();
  return { status: "ok", message: t.saved };
}
