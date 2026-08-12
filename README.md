# Shopify Lookbook

A lookbook feature for Shopify Online Store 2.0. Merchandisers curate named sets of
products as **metaobjects** in the admin; the storefront renders them with **React**,
fetching product data at runtime from the **Storefront API** so prices are correct for
the shopper's market.

Built for the Convert Digital technical assessment. No third-party apps.

|                 |                                                        |
| --------------- | ------------------------------------------------------ |
| **Store**       | `convert-digital-john-kenneth-fernandez.myshopify.com` |
| **Theme**       | `Lookbook` (published, id `153449037959`)              |
| **Markets**     | Australia (AUD, primary) · Japan (JPY)                 |
| **API version** | `2026-07`, pinned                                      |

---

## What it does

**Home page** — the merchant picks which lookbook to show, in the theme customizer.

**Product page** — no picker. The section surfaces whichever lookbooks contain the
product being viewed, capped at two. Every other setting is identical to the home-page
section, because both render through `snippets/lookbook-mount.liquid`.

`rust-bomber-jacket` belongs to all three seeded lookbooks, so its product page is the
live proof of the cap: it renders **Autumn Layers** and **Weekend Edit**, never
**Monochrome Study**.

---

## Quick start

```bash
npm install
cp .env.example .env        # see docs/runbooks/store-setup.md

npm run setup:metaobjects   # the lookbook metaobject definition
npm run setup:catalog       # 11 demo products with imagery
npm run setup:lookbooks     # 3 overlapping lookbooks
npm run setup:markets       # AU + JP markets, JPY price list

npm run build               # React island -> theme/assets/lookbook.{js,css}
npm run theme:push          # create the theme (unpublished)
npm run theme:deploy        # update the live theme
```

Every `setup:*` script is idempotent. Then paste the Storefront API token into
**Online Store → Themes → Customize → Theme settings**; without it the sections render
nothing and explain why in the editor.

### Local development

Two terminals:

```bash
npm run build:watch    # rebuild the island on change
npm run dev            # theme dev server on http://127.0.0.1:9292
```

`npm run dev` reads the store and its password from `.env`, so it starts without
prompting. Development stores cannot turn password protection off, which is why
`SHOPIFY_STORE_PASSWORD` is needed. Liquid and CSS hot-reload; changes to `src/lookbook/`
reload once `build:watch` has rewritten the bundle.

```bash
npm test               # vitest, with coverage thresholds
npm run lint           # eslint + shopify theme check
npm run verify:bundle  # fail if committed build output is stale
```

---

## How it works

**Liquid decides _which_ lookbooks render; React fetches _what is in them_.**

```
┌─ Liquid (server, per request) ──────────────────────────────────────┐
│  reads  shop.metaobjects.lookbook                                    │
│  home page     -> the one the merchant selected                      │
│  product page  -> those whose product_handles include product.handle │
│                   sorted by priority, capped at 2                    │
│  renders the header; emits <div data-lookbook="{ handles[], … }">    │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  JSON in a data attribute
┌──────────────────────────▼─ React 19 island (browser) ──────────────┐
│  one Storefront API request, handles looked up exactly by alias      │
│  @inContext(country:) -> market price + compare-at overrides         │
│  formats money with Intl.NumberFormat — never converts               │
└──────────────────────────────────────────────────────────────────────┘
```

Matching is a **content** question the server can answer for free from data already in
the render. Fetching product data is a **catalog** question the brief assigns to the
Storefront API. Full reasoning in
[ADR-0003](docs/adr/0003-liquid-selects-react-fetches.md).

### The data model

One metaobject type, `lookbook`: `title`, `description`, `product_handles`
(**handles only**, in display order), and `priority`.

`priority` is the only field the brief does not name. The brief caps product pages at
two lookbooks but never says _which_ two, and admin ordering is not a contract — so
selection is explicit: filter by membership, sort by priority, tie-break on handle, take
two. Implemented in `snippets/lookbook-match.liquid` and tested by running **that file**
through `liquidjs`, not a reimplementation of it.

Handles rather than product references is a requirement of the brief, and it costs
something: renaming a product silently drops it from every lookbook.
[ADR-0002](docs/adr/0002-handles-not-product-references.md).

### Market pricing

`localization.country.iso_code` → `@inContext(country:)`. Shopify applies price-list
overrides server-side, so amounts arrive correct and the client only formats them.
Nothing in the bundle multiplies a price by anything.

| Product             | Australia     | Japan             | price ratio | compare-at ratio |
| ------------------- | ------------- | ----------------- | ----------- | ---------------- |
| Camel Wool Overcoat | A$689 / A$849 | ¥78,000 / ¥92,000 | 113.2       | **108.4**        |
| Rust Bomber Jacket  | A$349 / A$429 | ¥39,800 / ¥52,000 | 114.0       | **121.2**        |

The ratios differ per product, and differ again between price and compare-at on the same
product. No single conversion produces those numbers — which is the point.

---

## Project structure

```
src/lookbook/        React island — the only code that gets bundled
  index.jsx            mount: finds [data-lookbook] nodes, hydrates each
  Lookbook.jsx         the product grid and its loading / empty / error states
  ProductCard.jsx      image, vendor, title, price, compare-at
  api/                 query construction, handle validation, GraphQL client
  lib/                 money formatting (never converts), merchandiser ordering

theme/
  sections/lookbook.liquid          home page — has the metaobject picker
  sections/lookbook-product.liquid  product page — no picker
  snippets/lookbook-mount.liquid    shared header, settings and mount markup
  snippets/lookbook-match.liquid    the max-two rule
  assets/lookbook.{js,css}          BUILD OUTPUT — committed, never hand-edited

scripts/setup/       idempotent Admin API setup
tests/               unit · liquid (real .liquid files) · e2e (live storefront)
docs/adr/            architecture decision records
```

---

## Testing

105 unit and Liquid tests, plus 7 end-to-end. Coverage thresholds enforced in CI.

| Level  | Covers                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit   | JPY zero-decimal formatting; compare-at only when strictly higher; handle validation rejecting GraphQL injection; batching; retry-once; GraphQL errors arriving with HTTP 200 |
| Liquid | the max-two rule and the mount snippet, run against the real `.liquid` files                                                                                                  |
| E2E    | product data arriving over the network rather than in the HTML; a product in three lookbooks rendering exactly two; switching to Japan showing yen at a non-converted value   |

```bash
SHOPIFY_STORE_URL=https://your-store.myshopify.com \
SHOPIFY_STORE_PASSWORD=your-storefront-password \
npm run test:e2e
```

E2E skips without those variables, so a fork with no secrets still gets a green run. CI
runs them as a separate job — a live storefront fails for reasons unrelated to the
commit, and that should not block the unit pipeline.

---

## Performance

Lighthouse, mobile, home page: **Performance 67 · Accessibility 98 · Best Practices 79 ·
SEO 100**. FCP 1.9 s, Speed Index 2.7 s, CLS 0.098, **LCP 9.6 s**.

LCP is poor and the cause is structural: 7.4 s of it is _resource load delay_, the gap
before the LCP image can begin downloading. The browser cannot know the URL until the
island has booted and the Storefront API has answered — which is the brief's
handles-only, fetch-at-runtime requirement made visible. A Liquid-rendered grid would
have its image URLs in the initial HTML and a far better LCP, and would not satisfy the
brief.

Mitigated by server-rendering the header, loading the first row `eager` at high priority
(Speed Index 4.3 s → 2.7 s), setting intrinsic dimensions on every image, and
preconnecting to the image CDN. The remaining lever — firing the Storefront request from
a small inline script before the bundle loads — is deliberately not taken: it adds a
second code path through the part of this project where correctness matters most.

---

## Notes for a reviewer

**Start at** `theme/snippets/lookbook-match.liquid`; `tests/liquid/` proves it.

**Build output is committed** because Shopify serves `theme/assets/` from what
`theme push` uploads. `npm run verify:bundle` rebuilds in CI and fails on drift.

**Failures are deliberate.** A lookbook that cannot render removes itself on the
storefront rather than leaving a heading above blank space; the theme editor spells out
why, including which handles no longer match a product.

**No cart or checkout.** The store's only location is point-of-sale only and Shopify
locks online fulfilment off for the default location, so every product reports as
unavailable. Cart is outside the brief, and a permanently disabled "Sold out" button
would state something false about the catalog.

---

## Decisions

- [ADR-0001 — A build step for the React island](docs/adr/0001-react-island-build-step.md)
- [ADR-0002 — Handles, not product references](docs/adr/0002-handles-not-product-references.md)
- [ADR-0003 — Liquid selects, React fetches](docs/adr/0003-liquid-selects-react-fetches.md)
- [ADR-0004 — Tailwind without Preflight](docs/adr/0004-tailwind-without-preflight.md)

Store setup from zero: [`docs/runbooks/store-setup.md`](docs/runbooks/store-setup.md).
For merchandisers: [`docs/client-training/managing-lookbooks.md`](docs/client-training/managing-lookbooks.md).
