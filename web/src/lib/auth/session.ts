import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { adminDb, dbError } from "@/lib/supabase/server";

/**
 * Web sessions (no Supabase Auth): logging in redeems a /cz link code, which creates a
 * row in web_sessions. The cookie holds a random token; the database stores only its hash.
 */

export const SESSION_COOKIE = "cz-session";
export const SESSION_DAYS = 30;

export type StaffRole = "ADMIN" | "SUPERADMIN";

export type Player = {
  uuid: string;
  name: string;
  role: StaffRole | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The logged-in player, or null. Deduplicated per request. */
export const getCurrentPlayer = cache(async (): Promise<Player | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // The expiry check reads the clock: render at request time, never in a prerender.
  await connection();
  const { data, error } = await adminDb()
    .from("web_sessions")
    // staff has two FKs to players (player_uuid, granted_by): name the one to embed.
    .select("player:players!inner(uuid, name, staff!staff_player_uuid_fkey(role))")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data?.player) return null;

  const staff = Array.isArray(data.player.staff) ? data.player.staff[0] : data.player.staff;
  return { uuid: data.player.uuid, name: data.player.name, role: staff?.role ?? null };
});

/** For pages and actions that need a player: redirects to the login page otherwise. */
export async function requirePlayer(nextPath: string): Promise<Player> {
  const player = await getCurrentPlayer();
  if (!player) redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  return player;
}

/** For admin pages and actions: hides them (404) from anyone who is not staff. */
export async function requireStaff(role: StaffRole = "ADMIN"): Promise<Player> {
  const player = await getCurrentPlayer();
  if (!player?.role || (role === "SUPERADMIN" && player.role !== "SUPERADMIN")) notFound();
  return player;
}

/**
 * Redeems a link code and sets the session cookie. Call only from a Server Action.
 * Returns the player name, or null when the code is unknown, expired or already used.
 */
export async function signIn(code: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await adminDb().rpc("redeem_link_code", {
    p_code: code,
    p_token_hash: hashToken(token),
    p_session_days: SESSION_DAYS,
  });
  if (error) throw dbError(error);
  const player = data?.[0];
  if (!player) return null;

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return player.player_name;
}

/** Deletes the current session (or every session of the player). Call only from a Server Action. */
export async function signOut({ everywhere = false } = {}): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = adminDb();
    if (everywhere) {
      const player = await getCurrentPlayer();
      if (player) await db.from("web_sessions").delete().eq("player_uuid", player.uuid);
    } else {
      await db.from("web_sessions").delete().eq("token_hash", hashToken(token));
    }
  }
  store.delete(SESSION_COOKIE);
}
