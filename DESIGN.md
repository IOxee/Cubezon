# Cubezon visual design — «Cartilla»

> Status: prototype (2026-10-09). Items marked «pending» are deferred until the prototype works.

Applies only to the website (`web/`, Next.js + Tailwind 4), which replaces the default `create-next-app` template. Inventory menus and plugin messages are out of scope and handled separately.

Brief: a large, full-featured e-commerce site with the experience of a general marketplace. Cubezon sells through its own store and, in addition, approved small shops sell through the platform. It reproduces the usage patterns of a large marketplace (prominent search bar, categories, product page with buy box, «vendido por» ("sold by"), ratings, cart, order tracking up to the locker), but **not** its identity: no Amazon logo, smile, palette, typeface or name. Users: buyers (priority), sellers (shop dashboard) and admin.

## Idea

Material: **cardboard box with a shipping label, till receipt and ration-book style printed stationery**. Surfaces are raw paper printed in one or two inks; product cards read as labels or coupons (grid squares, serial numbers, perforated die-cut, rubber stamps); the till receipt (a strip of thermal paper with a serrated edge and monospaced text) appears in the cart, order summary and receipt. Edges may have a subtle pixelated step, like a Minecraft block seen up close.

Character: **efficient, dense, wry**. Lots of information per screen and fast navigation, like a large marketplace; humor goes in the copy and in small details, never at the expense of clarity.

Color: provided by **the content and a single accent of our own**. The interface is neutral (paper, cardboard, ink); vivid color comes from the in-game item icons and a brand accent reserved for buying and the primary action.

Excluded from the new style:

- Any Amazon identity trait: logo, smile or arrow, its signature orange and navy blue, the Ember typeface, the name.
- Bevels and grey panels from the Minecraft inventory as a general surface (at most, as an occasional nod).
- Gradients, frosted glass and generic template soft shadows.
- Loud deal banners and color everywhere.

## Theme

Light and dark. Defaults to the system setting (`prefers-color-scheme`). Visitors can force system / light / dark with the selector in the top strip and in the footer; the choice is stored in the `cz-theme` cookie and applied by an inline script in `<head>` before first paint (reading it in the server layout would block the whole site with Cache Components). Technique: CSS variables on `:root` and `[data-theme="dark"]`, exposed to Tailwind 4 with `@theme inline` (`web/src/app/globals.css`).

**Superadmin-configurable themes** (`/admin/temas`). The palette in this table is the base theme «Cartilla» (Spanish for a ration-book style printed booklet). A superadmin can create, activate and schedule alternative themes (e.g. seasonal or event themes) from the admin panel. Rules:

- A theme only overrides existing token values (light and dark); it adds no tokens and does not change shape, typography or spacing.
- It is stored in the DB (only the changed values) and the layout injects it as a cached `<style>` block (tag `theme`) inside the static shell, so it doesn't flicker either. A scheduled theme takes precedence within its window; outside it, the manually activated one; if there is none, Cartilla.
- On save, the contrast of text pairs (≥ 4.5:1) and icons (≥ 3:1) is validated in both modes; if it fails, the theme cannot be activated.
- There is always an active theme; if the active one is deleted or fails to load, it falls back to «Cartilla».

Base theme «Cartilla»: raw printing paper and greenish-black ink.

| Token     | Light     | Dark      | Use                              |
| --------- | --------- | --------- | -------------------------------- |
| `paper`   | `#ECE5D3` | `#161915` | Page background                  |
| `surface` | `#F7F2E4` | `#20231F` | Cards, panels, fields, menus     |
| `ink`     | `#1F2421` | `#ECE4D0` | Primary text, icons              |
| `ink-2`   | `#474C45` | `#BDB6A2` | Secondary text                   |
| `ink-3`   | `#62655C` | `#979181` | Metadata, placeholders           |
| `line`    | `#D4CAB2` | `#373B34` | Thin separators (no text on top) |
| `edge`    | `#1F2421` | `#ECE4D0` | Component outline                |
| `shadow`  | `#C3B696` | `#0A0C09` | Hard shadow for raised elements  |
| `danger`  | `#A3271F` | `#F08A7E` | Errors and destructive actions   |
| `success` | `#2E6838` | `#86C894` | Confirmations                    |

Measured contrast (on `paper` / `surface`): light — `ink` 12.5 / 14.1 · `ink-2` 7.0 / 7.9 · `ink-3` 4.7 / 5.3 · `danger` 5.8 / 6.6 · `success` 5.3 / 6.0. Dark — `ink` 14.0 / 12.5 · `ink-2` 8.8 / 7.9 · `ink-3` 5.6 / 5.1 · `danger` 7.3 / 6.5 · `success` 9.0 / 8.1.

Required contrast: normal text ≥ 4.5:1; large text and icons ≥ 3:1.

### Accent / per-entity color

**Brand accent: coupon ochre.** Only as a **fill** (buy button, primary action, deal badge); never as standalone text or an outline, because on `paper` it doesn't reach 3:1 (1.8:1 in light). That's why every accent fill has an `edge` outline. Content on top of it is always `on-accent`.

| Token          | Light     | Dark      | Use                         | Contrast with `on-accent` |
| -------------- | --------- | --------- | --------------------------- | ------------------------- |
| `accent`       | `#D9A21B` | `#E3B23C` | Buy / primary action fill   | 6.9 / 9.0                 |
| `accent-hover` | `#C48F12` | `#EDC25A` | Fill hover and pressed      | 5.5 / 10.5                |
| `on-accent`    | `#1F2421` | `#161915` | Text and icon on the accent | —                         |

Global variable `--accent` (plus `--accent-hover`, `--on-accent`). The brand is always Cubezon: the accent is not overridden per shop or per section; only a superadmin theme changes it.

**Shop ink.** Each shop picks an ink from a fixed palette of 8. It is used in its stamp (initials + shape), in the «vendido por» ("sold by") label and in the thin strip of its storefront; never on buttons, the header or the accent, which remain Cubezon's. All inks meet ≥ 4.5:1 as text on `paper` and `surface` in both modes (measured minimum: 5.5:1). The palette lives in the DB and a superadmin will be able to extend or edit it later, with the same contrast validation as themes.

| Ink                      | Key        | Light     | Dark      |
| ------------------------ | ---------- | --------- | --------- |
| Azul tampón (stamp blue) | `azul`     | `#234C8A` | `#8FB2E8` |
| Burdeos (burgundy)       | `burdeos`  | `#8A2340` | `#F09AB2` |
| Botella (bottle green)   | `botella`  | `#2B5E3F` | `#8FCFA5` |
| Violeta (violet)         | `violeta`  | `#5B3A8C` | `#BFA6EE` |
| Petróleo (petrol blue)   | `petroleo` | `#1D5E66` | `#86CBD3` |
| Sepia                    | `sepia`    | `#6E4A22` | `#D9B48A` |
| Grafito (graphite)       | `grafito`  | `#3F4448` | `#BFC4C8` |
| Teja (terracotta)        | `teja`     | `#9A3B1C` | `#F2A285` |

Applied with `--shop-ink` on the shop or card container (`style="--shop-ink: var(--ink-azul)"`). The official Cubezon shop uses `grafito` with its own stamp.

**App signature:** the **crooked rubber stamp**. Stamps rotated between −6° and 4° («VENDIDO» (sold), «RECOGIDO» (collected), «AGOTADO» (sold out), «OFICIAL» (official)) on cards, receipts and order statuses, with an uneven ink texture (SVG mask) and in the status or shop ink.

## Typography

| Role            | Family                                      | Use                                                                  |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Headings        | `Archivo` (variable, `wdth` 75, `wght` 700) | Page titles, product name, block headers                             |
| Body            | `Archivo` (`wdth` 100, `wght` 400/600)      | Interface text, descriptions, buttons, navigation                    |
| Data and labels | `IBM Plex Mono` (400/600)                   | Prices, quantities, order and serial numbers, receipt, linking codes |
| Logo and stamps | `Pixelify Sans` (600/700)                   | Only the name «Cubezon» and the rubber-stamp text                    |

Loading: `next/font/google` (self-hosted at build time; no requests to Google at runtime). Variables `--font-sans` (Archivo), `--font-mono` (Plex Mono), `--font-pixel` (Pixelify Sans). Archivo is loaded as a variable font with the `wght` and `wdth` axes.

Scale (px / line height): 12/16 · 13/18 · **15/22 (base)** · 17/24 · 20/26 · 24/30 · 32/36 · 40/44. Dense marketplace text: 15 px base; absolute minimum 12 px, only for mono metadata.

- Headings: letter-spacing −0.01 em, sentence case (`h1` 32 px, 40 px on the home page; `h2` 24 px; `h3` 20 px).
- Labels (field labels, small section headers, receipt columns): Plex Mono 12–13 px, 600, UPPERCASE, +0.06 em.
- Stamps: Pixelify Sans 700, UPPERCASE, +0.08 em.
- Numbers: Plex Mono with `font-variant-numeric: tabular-nums`; prices right-aligned in tables and in the receipt.
- Interface text (buttons, menus, titles): sentence case.

## Shape

- **Outline:** 2 px `edge` on controls (buttons, fields), cards and floating surfaces; 1 px `line` on separators and tables.
- **Corners:** no radii. Buttons have a 2 px pixel notch at the corners (`clip-path` on a pseudo-element, so the focus ring isn't clipped). Cards and panels are square-cornered, like cut paper.
- **Elevation:** flat at rest. Hard shadow `4px 4px 0` in `shadow` only on raised elements (clickable cards on hover, the receipt).
- **Interaction:** button as a cardboard key with a 3 px bottom edge that disappears when pressed; card hover: rises 2 px and gains the hard shadow; focus: 2 px `ink` outline offset by 2 px; disabled: 55% opacity.
- **Floating surfaces:** `surface` + 2 px `edge` outline + hard shadow.
- **Inner separators:** 1 px `line`; coupon die-cut: 2 px dashed line.

## Key components

Code in `web/src/components/` and classes in `globals.css` (summary in `docs/web.md`).

- **Product card (coupon):** original item icon over grid squares (`squares`), mono serial number, perforated die-cut, title, shop in its ink, rating in pixel squares, large mono price and stock; crooked «AGOTADO» (sold out) stamp when none is left.
- **Rubber stamp:** Pixelify Sans in uppercase, double rule, rotated between −8° and 4°, with a noise mask as uneven ink. Order statuses, official, sold out.
- **Till receipt:** `surface` paper, serrated edges (mask), mono text; cart, checkout and receipt.
- **Shop stamp:** initials in the shop's ink inside a double square.
- **Item icons:** the game's originals, served from a configurable CDN (`NEXT_PUBLIC_ITEM_ICON_URL`) and scaled with crisp pixels.

## Motion

Minimal and stepped (`steps()`), like a block game: card elevation (120 ms), button press (80 ms), blinking loading skeletons. Everything is disabled under `prefers-reduced-motion`.

## Copy and tone

Address the user informally (tú); short sentences, no emojis, and exclamation marks only in exceptional cases. Dry humor goes in secondary copy and empty states («El almacén está vacío» ("The warehouse is empty")), never in errors or anything involving money. Errors: what happened and what to do. All copy lives in `web/src/i18n/es/` (one file per area); item names in `web/src/i18n/items.es.ts`. Routes are in Spanish because users see them.

## Reference

- Tokens and primitives: `web/src/app/globals.css`.
- Components: `web/src/components/` (`ui/`, `catalog/`, `layout/`).
- Web architecture and conventions: `docs/web.md`.

## Decision log

<Claude adds one line per decision: date · section · decision → reason.>

- 2026-10-09 · Context · Web only; marketplace with its own store and small shops; large e-commerce patterns without Amazon's identity → the brief requires it and AGENTS.md forbids it.
- 2026-10-09 · Idea · Cardboard box with label and paper roll → combines a shipping warehouse and a Minecraft block.
- 2026-10-09 · Idea · Efficient, dense, wry → large-marketplace density with parody humor.
- 2026-10-09 · Idea · Color from content + one accent → the game items are already colorful; the accent is kept for buying.
- 2026-10-09 · Idea · Ration-book style stationery added and the roll becomes a till receipt → requested by the user; provides coupons, stamps and die-cuts as resources.
- 2026-10-09 · Theme · Light + dark following the system, selector in the `cz-theme` cookie read on the server → no flicker with SSR.
- 2026-10-09 · Theme · Superadmin-configurable themes that only override tokens, with contrast validation → customization without breaking accessibility.
- 2026-10-09 · Theme · Base palette «Cartilla» (raw paper `#ECE5D3`, ink `#1F2421`) → ration-print aesthetic.
- 2026-10-09 · Accent · Coupon ochre only as a fill with ink text and `edge` outline → 6.9:1 text contrast; on paper it doesn't reach 3:1 without an outline.
- 2026-10-09 · Accent · Orange rejected → fails contrast and recalls Amazon.
- 2026-10-09 · Accent · 8 shop inks in the DB, editable later, always under the Cubezon brand → shop identity without breaking the palette.
- 2026-10-09 · Accent · Signature: crooked rubber stamp → sums up the ration-book aesthetic and marks statuses.
- 2026-10-09 · Typography · Archivo (narrow headings + body) and IBM Plex Mono for data → official printed-form look with two font files; mono for the receipt.
- 2026-10-09 · Typography · Pixelify Sans only in the logo and stamps → a nod to Minecraft without hurting readability.
- 2026-10-09 · Typography · Sentence case; uppercase mono labels +0.06 em; 15 px base → marketplace density with a form-like feel.
- 2026-10-09 · Shape · No radii, pixel notch on buttons, hard shadow only when raised → cut paper and a block seen up close, no soft shadows.
- 2026-10-09 · Icons · Original game icons from a CDN instead of custom sprites → requested by the user; priority is getting the prototype working.
- 2026-10-09 · Scope · Prototype: theme selector and superadmin themes left pending → first get the buying, selling and admin flows working.
- 2026-10-09 · Theme · System/light/dark selector and superadmin themes implemented (editor with preview in both modes and contrast validation on client and server) → requested by the user.
- 2026-10-09 · Header · Categories in a dropdown menu (with the top 5 visible on wide screens) instead of a horizontally scrolling row; «Mi cuenta» ("My account") opens a quick-links menu → user request.
- 2026-10-09 · Ratings · Scores from 0.5 to 5 in 0.5 steps; each pixel square fills fully or by half and is chosen by clicking its left or right half → user request.
- 2026-10-09 · Header · The bar separates the catalog (left) from the site sections (Tiendas, Taquillas, Ayuda and Vender — Shops, Lockers, Help, Sell — on the right, with a divider and icons) → user request.
