# Cubezon web

Next.js 16 marketplace, seller panel and admin for Cubezon. See the [main README](../README.md) for setup.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest
npm run typecheck
npm run lint
npm run build
```

Environment variables go in `web/.env.local` (see [`.env.example`](../.env.example)). Architecture notes: [`docs/web.md`](../docs/web.md).
