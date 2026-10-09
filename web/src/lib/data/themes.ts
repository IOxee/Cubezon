import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";
import { schedulePhase, type SchedulePhase } from "@/lib/theme/schedule";
import { sanitizeTokens, themeCss, type ThemeTokens } from "@/lib/theme/tokens";

/**
 * Superadmin themes (table public.themes). A theme only overrides design tokens; the base
 * theme "Cartilla" lives in globals.css. The view public.current_theme picks the theme to apply
 * now: a scheduled one inside its window wins over the one active by hand.
 */

export const THEME_TAG = "theme";

export type ThemeRecord = {
  id: string;
  name: string;
  tokens: ThemeTokens;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  creatorName: string | null;
  /** Where now falls in the schedule window, or null when it is not scheduled. */
  phase: SchedulePhase | null;
};

/** CSS of the theme in force now ("" = base theme). Never throws: a failure means "Cartilla". */
export async function getCurrentThemeCss(): Promise<string> {
  "use cache";
  // Scheduled themes start and end on their own: re-check every minute.
  cacheLife("minutes");
  cacheTag(THEME_TAG);
  try {
    const { data, error } = await publicDb().from("current_theme").select("tokens").maybeSingle();
    if (error) throw dbError(error);
    return data ? themeCss(data.tokens) : "";
  } catch (error) {
    console.error("Could not load the current theme; using the base theme.", error);
    return "";
  }
}

/** Id of the theme in force now, or null for the base theme (uncached, for the admin list). */
export async function getCurrentThemeId(): Promise<string | null> {
  const { data, error } = await adminDb().from("current_theme").select("id").maybeSingle();
  if (error) throw dbError(error);
  return data?.id ?? null;
}

const COLUMNS = "id, name, tokens, is_active, starts_at, ends_at, created_at, updated_at, creator:players(name)";

type ThemeRow = {
  id: string;
  name: string;
  tokens: unknown;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  creator: { name: string } | null;
};

function toRecord(row: ThemeRow): ThemeRecord {
  const phase = row.starts_at && row.ends_at ? schedulePhase(row.starts_at, row.ends_at, Date.now()) : null;
  return {
    id: row.id,
    name: row.name,
    tokens: sanitizeTokens(row.tokens),
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creatorName: row.creator?.name ?? null,
    phase,
  };
}

export async function listThemes(): Promise<ThemeRecord[]> {
  const { data, error } = await adminDb().from("themes").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map((row) => toRecord(row as ThemeRow));
}

export async function getTheme(id: string): Promise<ThemeRecord | null> {
  const { data, error } = await adminDb().from("themes").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw dbError(error);
  return data ? toRecord(data as ThemeRow) : null;
}

export type ThemeInput = {
  name: string;
  tokens: ThemeTokens;
  startsAt: string | null;
  endsAt: string | null;
};

/** Creates a theme; returns its id, or "duplicate" when the name is taken. */
export async function createTheme(input: ThemeInput, creatorUuid: string): Promise<string | "duplicate"> {
  const { data, error } = await adminDb()
    .from("themes")
    .insert({
      name: input.name,
      tokens: input.tokens,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: creatorUuid,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return "duplicate";
  if (error) throw dbError(error);
  return data.id;
}

/** Updates a theme; returns false when it no longer exists, "duplicate" when the name is taken. */
export async function updateTheme(id: string, input: ThemeInput): Promise<boolean | "duplicate"> {
  const { data, error } = await adminDb()
    .from("themes")
    .update({ name: input.name, tokens: input.tokens, starts_at: input.startsAt, ends_at: input.endsAt })
    .eq("id", id)
    .select("id");
  if (error?.code === "23505") return "duplicate";
  if (error) throw dbError(error);
  return (data ?? []).length > 0;
}

export async function deleteTheme(id: string): Promise<boolean> {
  const { data, error } = await adminDb().from("themes").delete().eq("id", id).select("id");
  if (error) throw dbError(error);
  return (data ?? []).length > 0;
}

/** Activates one theme by hand (or none, with null: back to the base theme). */
export async function setActiveTheme(id: string | null): Promise<void> {
  const { error } = await adminDb().rpc("set_active_theme", { p_theme_id: id as string });
  if (error) throw dbError(error);
}
