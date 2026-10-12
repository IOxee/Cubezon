# Cubezon

[![CI](https://github.com/IOxee/Cubezon/actions/workflows/ci.yml/badge.svg)](https://github.com/IOxee/Cubezon/actions/workflows/ci.yml)
![Java 21](https://img.shields.io/badge/Java-21-1F2421)
![Paper 1.21](https://img.shields.io/badge/Paper-1.21.11-1F2421)
![Next.js 16](https://img.shields.io/badge/Next.js-16-1F2421)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-1F2421)
[![License: MIT](https://img.shields.io/badge/License-MIT-D9A21B)](LICENSE)

**English** · [Español](docs/i18n/README.es.md)

A parody marketplace for a Minecraft server. Approved player shops sell in-game items for in-game money on a website, and buyers pick up their orders from a locker (or their own mailbox) inside the game.

> Portfolio project. Not affiliated with Amazon or Mojang. Only in-game money is ever involved.

![Cubezon home page](docs/media/home-light.png)

<table>
  <tr>
    <td><img src="docs/media/catalog-light.png" alt="Catalog with filters"></td>
    <td><img src="docs/media/product-light.png" alt="Product page with buy box"></td>
  </tr>
  <tr>
    <td><img src="docs/media/shop-light.png" alt="Shop storefront"></td>
    <td><img src="docs/media/home-dark.png" alt="Dark theme"></td>
  </tr>
</table>

<!-- Demo video: drag the .mp4 into this README on github.com to upload it and paste the generated link here. -->

## How it works

```
 Web (Next.js)                 Supabase (PostgreSQL)              Paper plugin (Java)
 ─────────────                 ─────────────────────              ───────────────────
 browse, cart, checkout  ───►  orders: PENDING          ◄───────  polls pending orders
                                                                  charges buyer (Vault)
                               orders: PAID → READY     ◄───────  reserves stock, pays seller
 order tracking          ◄───  order_events (trigger)
                               orders: COLLECTED        ◄───────  player opens the locker
```

- **The plugin is the only authority over money and items.** The website can only create `PENDING` orders; it never touches balances, inventories or escrow.
- **Stock exists only if it was deposited.** Sellers put real items into escrow in-game (`/cz deposit`); nothing is ever created out of thin air.
- **Fail safe, never duplicate.** Orders are claimed, charged and completed in separate steps; an interrupted order is failed on startup and logged for review instead of being charged twice. Seller payouts are marked before paying, so a crash can leave a payout pending but never pays twice.
- **Row Level Security everywhere.** The public (publishable) key can only read approved shops, active listings, lockers and public views. The secret key stays on the server.

## Features

**Buyers (web)**
- Catalog with search, filters and categories, product pages, shop storefronts and reviews.
- Cart, checkout and live order tracking (`PENDING → PAID → READY → COLLECTED`, plus `FAILED`/`REFUNDED`).
- Sign-in with a one-time code generated in-game (`/cz link`), no passwords.
- Delivery to a public locker or express delivery to the buyer's own mailbox.

**Sellers**
- Several shops per player (configurable slots), employees with ranks and fine-grained permissions.
- Product management from the web or from an in-game "company computer".
- Shop zones in the world with storage blocks that define how much stock the shop can hold.
- Custom items from ItemsAdder, MMOItems, CraftEngine and other plugins (detected by reflection or PDC keys).

**Order modes** (set in `config.yml`)
- `automatic`: the plugin charges and fulfils each order on its own.
- `roleplay`: shop staff accept or reject orders at their computer, print a package and carry it to the locker themselves.

**Admins**
- Shop approval, lockers, players and shop slots, staff, read-only orders.
- Seasonal themes with automatic WCAG contrast checks.

**Languages**
- English by default and Spanish, on the web (selector in the header and footer) and in game (`locale` in `config.yml`). Both are checked to have the same keys and placeholders.

## Tech stack

| Part | Stack |
| --- | --- |
| `plugin/` | Paper 1.21.11, Java 21, Gradle (Kotlin DSL), Vault API, HikariCP, JUnit 6 |
| `web/` | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, Vitest |
| `supabase/` | PostgreSQL on Supabase: versioned migrations, RLS, triggers and RPC functions, Storage buckets |

## Repository layout

```
plugin/               Paper plugin (orders, escrow, lockers, mailboxes, storage, roleplay computer)
web/                  Next.js marketplace, seller panel and admin
supabase/migrations/  SQL schema, shared by the plugin and the web
docs/                 Web architecture notes, item data and screenshots
.github/workflows/    CI: plugin build + JUnit, web lint + typecheck + Vitest
DESIGN.md             Visual design system of the web ("Cartilla")
AGENTS.md             Domain rules and conventions for coding agents
MEMORY.md             Working notes between sessions (Spanish)
```

## Getting started

### Requirements

- Java 21, Node.js 20+ and npm
- A [Supabase](https://supabase.com) project (the free tier is enough)
- A Paper 1.21.11 server with [Vault](https://www.spigotmc.org/resources/vault.34315/) and an economy plugin (e.g. EssentialsX)

### 1. Database

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the whole schema, RLS policies and the `shop-media` and `item-icons` storage buckets.

### 2. Environment

Copy [`.env.example`](.env.example) to `.env` (used by the plugin's test server) and to `web/.env.local`, then fill in your Supabase URL and keys. Never commit the real files.

The plugin uses a direct connection or the **session** pooler (port 5432), not the transaction pooler (6543).

### 3. Plugin

```bash
cd plugin
./gradlew build
```

Copy `plugin/build/libs/cubezon-plugin-<version>.jar` into your server's `plugins/` folder. The database is enabled automatically when `CUBEZON_DB_URL` is set (or set it in `plugins/Cubezon/config.yml`).

### 4. Web

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000, join the server, run `/cz link` and use the code to sign in. To make yourself the first superadmin, run this in the Supabase SQL editor after joining the server once:

```sql
insert into public.staff (player_uuid, role)
select uuid, 'SUPERADMIN' from public.players where name = '<YourPlayerName>';
```

## In-game commands

`/cubezon` (alias `/cz`):

| Command | Who | What |
| --- | --- | --- |
| `link` | everyone | One-time code to sign in on the web |
| `deposit` | sellers | Put stock into a product |
| `pickup` | everyone | Collect ready orders from a nearby locker |
| `storage [buy\|give\|type ...]` | sellers / admins | Storage blocks and storage types |
| `computer buy\|give` | sellers / admins | Company computer (roleplay mode) |
| `mailbox [buy\|give]` | everyone | Personal mailbox for express delivery |
| `employee add\|remove\|list` | shop owners | Hire, fire and list shop staff |
| `item info\|register` | everyone / admins | Show the key of the item in hand / register it in the web catalog |
| `locker create\|remove\|list` | admins | Pickup lockers |
| `shop <slug\|id>`, `shop settings slots ...` | admins | Shop zone wand, shop slots |
| `reload` | admins | Reload configuration and messages |

Texts come in English (default) and Spanish: `plugin/src/main/resources/lang/{en,es}.yml` (set `locale` in `config.yml`) and `web/src/i18n/{en,es}/` (visitors switch with the EN/ES selector; the choice is kept in a cookie and URLs stay the same).

## Tests

```bash
cd plugin && ./gradlew test
cd web && npm test && npm run typecheck && npm run lint
```

## Security

- The publishable key can only read public data (RLS on every table); the secret key never leaves the web server.
- Every seller and admin action re-checks permissions in SQL (`shop_member_can`), not only in the UI.
- Sign-in codes are single-use, expire in minutes and are rate limited per IP and globally.
- Uploads are capped at 2 MB and sniffed by magic bytes (PNG, JPEG, WebP only).

Found something? Please open a private [security advisory](https://github.com/IOxee/Cubezon/security/advisories/new) instead of a public issue.

## License

[MIT](LICENSE)
