/**
 * Supabase project URL read when called, not when built: a literal `process.env.NEXT_PUBLIC_*`
 * is inlined by the bundler, which would bake the build machine's project into the output.
 * Server-only in practice; in the browser it is undefined and storage URLs resolve to null.
 */
export function supabaseUrl(): string | undefined {
  return runtimeEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function runtimeEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
