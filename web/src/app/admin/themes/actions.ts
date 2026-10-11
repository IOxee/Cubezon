"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/admin/action-form";
import { fmt, m } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/catalog";
import { THEME_TAG, createTheme, deleteTheme, getTheme, setActiveTheme, updateTheme } from "@/lib/data/themes";
import { zoneLocalToIso } from "@/lib/theme/schedule";
import { passesContrast, sanitizeTokens } from "@/lib/theme/tokens";

const t = m.admin.themes;

function fail(message: string): ActionState {
  return { status: "error", message };
}

/**
 * Creates (themeId null) or updates a theme. Only values that differ from the base theme are
 * stored. A theme that is active or scheduled must pass the contrast rules to be saved.
 */
export async function saveThemeAction(themeId: string | null, _state: ActionState, formData: FormData): Promise<ActionState> {
  const player = await requireStaff("SUPERADMIN");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3 || name.length > 40) return fail(t.errors.name);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("tokens") ?? ""));
  } catch {
    return fail(t.errors.invalid);
  }
  const tokens = sanitizeTokens(raw);
  const contrastOk = passesContrast(tokens);

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  if (formData.get("scheduled") === "on") {
    startsAt = zoneLocalToIso(String(formData.get("startsAt") ?? ""));
    endsAt = zoneLocalToIso(String(formData.get("endsAt") ?? ""));
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return fail(t.errors.schedule);
    if (!contrastOk) return fail(t.errors.contrast);
  }

  if (themeId === null) {
    const id = await createTheme({ name, tokens, startsAt, endsAt }, player.uuid);
    if (id === "duplicate") return fail(t.errors.duplicate);
    updateTag(THEME_TAG);
    redirect(`/admin/temas/${id}?aviso=creado`);
  }

  if (!isUuid(themeId)) return fail(t.errors.invalid);
  const existing = await getTheme(themeId);
  if (!existing) return fail(t.errors.notFound);
  if (existing.isActive && !contrastOk) return fail(t.errors.contrastActive);

  const updated = await updateTheme(themeId, { name, tokens, startsAt, endsAt });
  if (updated === "duplicate") return fail(t.errors.duplicate);
  if (!updated) return fail(t.errors.notFound);
  updateTag(THEME_TAG);
  refresh();
  return { status: "ok", message: t.done.saved };
}

/** Activates a theme by hand (it must pass the contrast rules). */
export async function activateThemeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff("SUPERADMIN");
  const themeId = formData.get("themeId");
  if (!isUuid(themeId)) return fail(t.errors.invalid);

  const theme = await getTheme(themeId);
  if (!theme) return fail(t.errors.notFound);
  if (!passesContrast(theme.tokens)) return fail(t.errors.contrast);

  await setActiveTheme(theme.id);
  updateTag(THEME_TAG);
  // Re-render the page: the list (badges, "Activar"/"Desactivar") reads uncached data.
  refresh();
  return { status: "ok", message: fmt(t.done.activated, { name: theme.name }) };
}

/** No theme active by hand: back to the base theme (scheduled ones still apply in their window). */
export async function deactivateThemeAction(): Promise<ActionState> {
  await requireStaff("SUPERADMIN");
  await setActiveTheme(null);
  updateTag(THEME_TAG);
  refresh();
  return { status: "ok", message: t.done.deactivated };
}

export async function deleteThemeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff("SUPERADMIN");
  const themeId = formData.get("themeId");
  if (!isUuid(themeId)) return fail(t.errors.invalid);

  if (!(await deleteTheme(themeId))) return fail(t.errors.notFound);
  updateTag(THEME_TAG);
  redirect("/admin/temas?aviso=borrado");
}
