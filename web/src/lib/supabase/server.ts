import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type Db = SupabaseClient<Database>;

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

let publicClient: Db | undefined;
let adminClient: Db | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

/** Publishable key: only what RLS makes public (catalog views, shops, lockers, inks). */
export function publicDb(): Db {
  publicClient ??= createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    options,
  );
  return publicClient;
}

/**
 * Supabase returns errors as plain objects ({ code, details, hint, message }); throw a real
 * Error so the dev overlay and logs show what failed.
 */
export function dbError(error: { message: string; code?: string; details?: unknown; hint?: unknown }): Error {
  const detail = typeof error.details === "string" && error.details ? ` — ${error.details}` : "";
  return new Error(`Database error ${error.code ?? ""}: ${error.message}${detail}`.trim(), { cause: error });
}

/**
 * Secret key: bypasses RLS. Server only, and only after an authorization check
 * (src/lib/auth/session.ts). Never hand this client or its data unfiltered to the client.
 */
export function adminDb(): Db {
  adminClient ??= createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), options);
  return adminClient;
}
