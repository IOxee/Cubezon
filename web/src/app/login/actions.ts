"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fmt, m } from "@/i18n";
import { normalizeLinkCode, safeNextPath } from "@/lib/auth/link-code";
import { signIn } from "@/lib/auth/session";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

export type SignInState = { error: string | null; code: string };

/**
 * 10 attempts per IP every 10 minutes (in memory, per server instance). A code has 32^6
 * combinations and expires in minutes, so this is plenty to stop guessing. Successful logins
 * count too: otherwise a player could reset the limit with codes of their own account.
 */
const limiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const t = m.account.signIn.errors;
  const raw = formData.get("code");
  const typed = typeof raw === "string" ? raw.slice(0, 16) : "";

  const code = normalizeLinkCode(raw);
  if (!code) return { error: t.format, code: typed };

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders.get("x-forwarded-for"), requestHeaders.get("x-real-ip"));
  const limit = limiter.hit(ip);
  if (!limit.ok) {
    return { error: fmt(t.tooMany, { minutes: Math.max(1, Math.ceil(limit.retryAfterMs / 60_000)) }), code: typed };
  }

  let playerName: string | null;
  try {
    playerName = await signIn(code);
  } catch (error) {
    console.error("signIn failed", error);
    return { error: t.failed, code: typed };
  }
  if (!playerName) return { error: fmt(t.invalid, { command: m.commands.link }), code: typed };

  redirect(safeNextPath(formData.get("next")));
}
