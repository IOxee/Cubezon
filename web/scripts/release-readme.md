# Cubezon web (prebuilt)

Self-contained Next.js server built from the tagged source. It ships no data and no keys:
it was built against an empty database and reads your Supabase settings from the environment at runtime.

## Requirements

- Node.js 20.9 or later.
- A Supabase project with every migration in `supabase/migrations` applied (`npx supabase db push`).

## Run

Set these environment variables (same values as `web/.env.example`):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (server only, never exposed to the browser) |
| `PORT` | Optional, default `3000` |

Leave `HOSTNAME` unset (or use `0.0.0.0` / `localhost`). With `HOSTNAME=127.0.0.1`, Next.js proxies its own
rewrites over the network and the language routing loops (vercel/next.js#94745).

Then:

```bash
node server.js
```

Pages are prerendered empty and fill in with your data within a minute or two.
Put it behind a reverse proxy with HTTPS in production.
