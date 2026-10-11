# Cubezon web: architecture and conventions

Working, scalable prototype. Next.js 16.4 (App Router, **Cache Components** and Partial Prefetching enabled), React 19.3, Tailwind 4 and `@supabase/supabase-js`. Next 16 changes APIs: when in doubt, read `web/node_modules/next/dist/docs/` (especially `01-app/01-getting-started/08-caching.md`, `07-mutating-data.md` and `02-guides/authentication-with-cache-components.md`).

## Structure (`web/src`)

| Path | Contents |
| --- | --- |
| `app/` | Routes. One `actions.ts` (`"use server"`) next to the route that uses it. Route-specific components go in `_components/` inside that route. |
| `components/ui/` | Shared primitives: `ItemIcon`, `Price`, `Stamp`, `Notice`, `EmptyState`, `SectionHeader`, `SubmitButton`, `Rating`, `ShopSeal`/`SoldBy`, `OrderStatusStamp`. |
| `components/catalog/` | `ProductCard`, `ProductGrid`. |
| `components/layout/` | Header and footer (already in the root layout). |
| `lib/supabase/` | `publicDb()` (publishable key, only what RLS makes public), `adminDb()` (secret key, bypasses RLS) and `database.types.ts` (generated). |
| `lib/auth/session.ts` | `getCurrentPlayer()`, `requirePlayer(nextPath)`, `requireStaff(role?)`, `signIn(code)`, `signOut()`. `link-code.ts` holds the pure validators. |
| `lib/data/<area>.ts` | Data access layer per area (`import "server-only"`). `catalog.ts`: `searchCatalog`, `getCatalogItem`, `getCatalogItemsFresh`, `getActiveLockers`, `isUuid`. |
| `lib/cart.ts` | Cart in the `cz-cart` cookie (pure helpers). |
| `lib/format.ts` | `formatMoney`, `formatAmount`, `formatDate(Time)`, `toCents`, `centsToDecimal`, `serialOf`. Dates in `Europe/Madrid`. |
| `lib/categories.ts`, `lib/inks.ts`, `lib/items/icons.ts` | Categories (the DB computes them with `material_category`), shop inks (`inkStyle(ink)` sets `--shop-ink`) and original game icons (`NEXT_PUBLIC_ITEM_ICON_URL`). |
| `i18n/` | All texts. `import { m, fmt, plural } from "@/i18n"`. Each area has its own file in `i18n/es/<area>.ts` and is accessed as `m.<area>.<key>`; shared texts (`m.header`, `m.product`, `m.status`, `m.common`, `m.commands`…) are in `i18n/es/common.ts`. Item names: `itemName(material)` from `i18n/items.es.ts`. |

Routes and query parameters are in English, independent of the UI language (the texts stay in Spanish through i18n): `/search`, `/p/[id]`, `/t/[slug]`, `/shops`, `/lockers`, `/help`, `/login`, `/account`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/sell`, `/panel` (my shops) and `/panel/[shop]/...` (each shop's panel, by slug), `/admin/...`. Panel sections: `products` (`products/new`, `products/[id]`), `orders`, `staff`, `ranks`, `shop`. Admin sections: `shops`, `orders`, `lockers`, `photos`, `team`, `players`, `themes` (`themes/new`), `features`. Old Spanish paths (`/buscar`, `/panel/:shop/productos`, `/admin/tiendas`…) redirect permanently (308) to the English ones in `next.config.ts` (`LEGACY_PATHS`). Query parameters: `page`, `status`, `category`, `shop`, `sort`, `min`, `max`, `stock`, `q`, `own`, `product`, `units`, `new`, `notice`, `next`. Enum-like values in the URL (`?status=ready`, `?category=blocks`) are the lowercase key (`keySlug`/`keyFromSlug` in `lib/url-slug.ts`), never an i18n string. A player can own as many non-rejected shops as their quota allows (`players.shop_slots`, or the default `plugin_settings.default_shop_slots`; function `shop_slots_of`, enforced by a trigger) and work as an employee in others (`shop_members`, up to `plugin_settings.max_shop_memberships`; function `shop_memberships_of`). A superadmin changes quotas in `/admin/players`; in game, `/cz shop settings slots <player> [n|reset]`. Every panel page and action uses `requireSellerShop(slug, next, { ownerOnly?, permission? })`, which lets in the owner and employees and returns `shop.role` and `shop.permissions` (from `shop_permissions_of`; the owner gets all of them).
- **Ranks** (`shop_roles`, created by the DB for each shop; `lib/data/shop-roles.ts`): each employee has one, with permissions from `SHOP_PERMISSIONS` (`lib/seller/permissions.ts`, same as `shop_permission_list()`). Only the owner manages them, in `/panel/[shop]/ranks` (table + `Modal` window for editing). The default rank is changed with the `set_default_shop_role` RPC (one transaction). Game rules, repeated on the web: `products.manage` to create/edit/pause/remove/restore products; `staff.manage` to hire, fire and change ranks, but a non-owner cannot grant a rank with `staff.manage` nor touch someone who has it (`canAssignRole`, `canManageMember`). All staff see the overview, products, orders and employees; settings, public profile and ranks are `ownerOnly`.
- In the UI, `listings` are called **productos** ("products", same as in game), never «anuncios» ("ads"). Their panel is at `/panel/[shop]/products` (`/anuncios` redirects there, in `next.config.ts`). They are created from the web or from the in-game computer (with an empty `description`). Removing a product only changes its status to `REMOVED`: «Recuperar» ("Restore") brings it back paused (`restoreListing`).
- **Name and slug** can be changed at any time (no new approval). A trigger stores old slugs in `shop_slug_history` (`/t/<old>` does a `permanentRedirect` to the current one) and prevents another shop from using a slug someone already had (23505). The shop id is the stable identifier.
- **Shop images** (logo and cover): public `shop-media` bucket in Supabase Storage. Only the server uploads, with `adminDb()` after checking the owner; `lib/shop-media.ts` validates the type (also by its bytes) and the size (≤ 2 MB) and builds the public URLs. The Server Actions body limit is 3 MB (`next.config.ts`).

## Data and security rules

- Public reads with `publicDb()` on the `catalog`, `shop_directory`, `public_reviews` and `current_theme` views and the `shops`/`listings`/`lockers`/`inks` tables (RLS). Everything else with `adminDb()`, **always after** `requirePlayer`/`requireStaff` and filtering by the player (`buyer_uuid`, `owner_uuid`…). Never pass a whole private row to a Client Component: only the fields needed.
- Every Server Action re-checks session and permissions and validates its input; it does not trust the form (prices, owners, statuses).
- The web **only** inserts `PENDING` orders (one per line), with `unit_price` copied from the product and `total = unit_price * quantity` (CHECK in the DB; compute in cents with `toCents`/`centsToDecimal`). It never changes an order's status nor touches `escrow_items` or balances: that is the plugin's job.
- Delivery (`orders.delivery_method`, `lib/delivery.ts`): `LOCKER` (with `locker_id`) or `MAILBOX`, express shipping to the buyer's mailbox (`mailbox_id`, no locker; mailboxes are placed through the plugin). Checkout offers it if `plugin_settings.express_enabled = 'true'` and the player has a mailbox; `express_fee` is copied when the order is created (like `unit_price`) and charged separately from `total`. Who sets it is `express_pricing` (`server` | `shop` | `shop-capped`, same rule as the plugin's `ExpressPricing.feeFor`, `shopExpressFeeCents`): with `server`, `express_fee` is charged **once per purchase** on the most expensive line; per shop, each shop charges its own (`shops.express_fee`, null = the server's; capped at `express_max_fee` in `shop-capped`) once per purchase, on its own most expensive line (`expressFeesByLine`). The owner sets it in `/panel/[shop]/shop` (`validateShopExpressFee`). The action re-reads settings, mailboxes and shop fees and compares the express total the page showed (`expressTotal`; if it changed, it asks the player to review). READY express orders read «En tu buzón» ("In your mailbox").
- Tips (`orders.tip`, `lib/tips.ts`): if `plugin_settings.tips_enabled = 'true'`, checkout has an optional tip per shop of the cart (0 to `tips_max`, per order), stored on that shop's most expensive line (`tipsByLine`). The plugin charges `total + express_fee + tip` and pays the tip to the courier (or the shop). Order pages show the fee and the tip only when > 0.
- Feature panel (`/admin/features`, `lib/features.ts`): kinds `boolean`, `integer`, `decimal` and `choice` (fixed lowercase words, e.g. `mailbox.express.pricing`; the plugin publishes it as a JSON string in `plugin_settings.features`).
- Reviews: one per `COLLECTED` order of its author (enforced by a trigger).
- After mutating public data, `updateTag("catalog")` (or the relevant tag: `lockers`, `shops`).

## Cache Components (what you need to know)

- Development options in `lib/dev-flags.ts` (ignored in production): `CUBEZON_DEV_ALLOW_SELF_PURCHASE=1` allows buying from your own shops.
- `cookies()`, `headers()`, `params`, `searchParams` and uncached reads go **inside `<Suspense>`**; otherwise the build fails ("blocking route"). Pattern: the synchronous page returns the static frame and a `<Suspense fallback={...}>` with an async component that does `await props.params` / `getCurrentPlayer()`.
- Public data: function with `"use cache"`, `cacheLife(...)` and `cacheTag(...)`. `cookies()` cannot be read inside `"use cache"`.
- `Date.now()`/`new Date()` only after a request API (`cookies()`, `connection()`) or inside `"use cache"`.

## Design (summary of `DESIGN.md`)

- Tokens as Tailwind colors: `paper`, `surface`, `ink`, `ink-2`, `ink-3`, `line`, `edge`, `shadow`, `danger`, `success`, `accent`, `accent-hover`, `on-accent`, `shop` (the shop's ink). There are no other colors (Tailwind's default palette is disabled), no rounded corners and no gradients.
- Classes from `globals.css`: `btn` (+ `btn-primary`, `btn-ink`, `btn-danger`, `btn-ghost`, `btn-sm`, `btn-lg`, `btn-block`), `input` (also on `select`/`textarea`), `label` (uppercase mono label), `num` (tabular mono figures), `card`, `card-soft`, `lift` (clickable card), `perforation`, `squares` (grid squares behind icons), `ticket` + `ticket-shadow` + `ticket-rule` (checkout receipt), `stamp` (use `<Stamp>`), `cmd` (game command), `badge` (+ `badge-accent`, `badge-ink`, `badge-paper`), `link`, `skeleton`.
- The accent (`accent`) is **fill** only (buy / primary action), always with an `edge` outline and `on-accent` text. Never as a text color.
- Typefaces: `font-sans` (Archivo; `h1`–`h4` are already condensed and bold), `font-mono` (IBM Plex Mono: prices, codes, order numbers, labels), `font-pixel` (Pixelify Sans: logo and stamps only).
- Tone: informal "tú", short sentences, dry humor only in secondary texts and empty states; never in errors or money. No emojis.

## Game commands (for help texts)

Subcommands are English-only, with no aliases. `/cz link` gives the 6-character code to sign in on the web. `/cz deposit` opens the menu to add stock to a listing (items must match `material` and `unit_amount`). Pickup: right-click the locker or `/cz pickup` near it. Shop storage: `/cz storage` (usage) and `/cz storage buy [type] [n]`; storage blocks only count inside the shop's zone. Company computer: `/cz computer buy [n]`. Mailbox: `/cz mailbox` (where yours is) and `/cz mailbox buy [n]`. Item in hand: `/cz item info` (its key). Employees: `/cz employee add|remove|list` (see below). Admin: `/cz locker create <name>`, `/cz locker remove <name> [other]` (moves its orders to another active locker), `/cz locker list`, `/cz shop <slug|id>` (gives the wand to mark a shop's zone; shops are identified by slug or id, never by name), `/cz shop settings slots <player> [n|reset]`, `/cz storage give <player> [type] [n]`, `/cz storage type create|remove|list`, `/cz computer give <player> [n]`, `/cz mailbox give <player> [n]`, `/cz item register` and `/cz reload`. `/cz` = `/cubezon`.

## Order modes and plugin items

- `plugin_settings.orders_mode` (`automatic` | `roleplay`), read with `getOrdersMode()` (`lib/data/roleplay.ts`, cached for minutes). In roleplay the shop accepts (PENDING → PAID, the buyer is charged) and delivers (→ READY, the seller gets paid) from its in-game computer. Per-mode texts are in `lib/order-display.ts` and `m.roleplay`; `failure_reason` codes are translated with `failureReasonText`. A `FAILED` order with `SHOP_REJECTED` or `EXPIRED` is not an error: it is shown as «Cancelado» ("Cancelled") (`isCancelled`, `CANCELLED_REASONS`); pass `failureReason` to `OrderStatusStamp` and to the status functions.
- Employees: `shop_members`. The owner manages them in `/panel/[shop]/staff` (or with `/cz employee add|remove <slug> <player>` and `/cz employee list <slug>`); the player must exist in `players`.
- Items from other plugins/mods: `listings.item_key` (namespaced; what the deposit compares) and `custom_items` (registered by an admin with `/cz item register`; icons in the `item-icons` bucket). `material` is still the vanilla base for icon and category. If you change the material of a vanilla listing, send `item_key` too.
- `listings.match_mode`: `KEY` (any variant) or `EXACT` (identical to the sample the owner sets in game). The web can switch back to KEY, never set EXACT.

## Themes

- Visitor picker: `components/theme/` (`cz-theme` cookie, inline script in `<head>` and `ThemeSwitcher`).
- Superadmin themes: `themes` table, `current_theme` view, `lib/theme/tokens.ts` (tokens, contrast, CSS), `lib/data/themes.ts` and `/admin/themes`. The active theme is injected in the root layout with `ThemeStyle` (cached, tag `theme`). `BASE_TOKENS` values must match `globals.css`.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (Vitest, `src/**/*.test.ts`) and `npm run build`.
- To test with another session without touching yours, use `http://pruebas.localhost:3000` (separate cookie store; the dev server accepts `localhost` subdomains). With `127.0.0.1` the dev server blocks its JavaScript and the page does not hydrate.
- First superadmin (after the player has joined the server):
  `insert into public.staff (player_uuid, role) select uuid, 'SUPERADMIN' from public.players where name = '<PlayerName>';`
