# Shopify Lookbook

A lookbook feature for Shopify Online Store 2.0. Merchandisers curate named sets of
products as **metaobjects** in the admin; the storefront renders them with **React**,
fetching product data at runtime from the **Storefront API** so prices are correct for
the shopper's market.

Built for the Convert Digital technical assessment. No third-party apps.

|                 |                                                        |
| --------------- | ------------------------------------------------------ |
| **Store**       | `convert-digital-john-kenneth-fernandez.myshopify.com` |
| **Theme**       | `Lookbook` (unpublished, id `153449037959`)            |
| **Markets**     | Australia (AUD, primary) · Japan (JPY)                 |
| **API version** | `2026-07`, pinned                                      |

---

## What it does

Two placements, deliberately different:

**Home page** — the merchant picks which lookbook to show, in the theme customizer.

**Product page** — no picker. The section surfaces whichever lookbooks contain the
product being viewed, capped at two. Every other setting is identical to the home-page
section.

`rust-bomber-jacket` belongs to all three seeded lookbooks, so its product page is the
live proof of the cap: it renders **Autumn Layers** and **Weekend Edit**, never
**Monochrome Study**.

---

## Quick start

```bash
npm install
cp .env.example .env        # then fill it in — see docs/runbooks/store-setup.md

npm run setup:metaobjects   # the lookbook metaobject definition
npm run setup:catalog       # 11 demo products with imagery
npm run setup:lookbooks     # 3 overlapping lookbooks
npm run setup:markets       # AU + JP markets, JPY price list

npm run build               # React island -> theme/assets/lookbook.{js,css}
npm run theme:push          # upload as a new unpublished theme
```

Every `setup:*` script is idempotent — run them as many times as you like.

Then set the Storefront API token in **Online Store → Themes → Customize → Theme
settings → Storefront API**. Without it the sections render nothing on the storefront
and explain why in the editor.

### Everyday commands

```bash
npm run dev            # shopify theme dev
npm run build:watch    # rebuild the island on change
npm test               # vitest, with coverage thresholds
npm run lint           # eslint + shopify theme check
npm run verify:bundle  # fail if committed build output is stale
```

---

## How it works

The central decision: **Liquid decides _which_ lookbooks render; React fetches _what is
in them_.**

```
┌─ Liquid (server, per request) ──────────────────────────────────────┐
│  reads  shop.metaobjects.lookbook                                    │
│  home page     -> the one the merchant selected                      │
│  product page  -> those whose product_handles include product.handle │
│                   sorted by priority, capped at 2                    │
│  renders the header: cover image, title, description                 │
│  emits  <div data-lookbook="{ handles[], market, settings, … }">     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  JSON in a data attribute
┌──────────────────────────▼─ React 19 island (browser) ──────────────┐
│  one Storefront API request per lookbook, handles looked up exactly  │
│  @inContext(country: AU|JP) -> market price + compare-at overrides   │
│  formats money with Intl.NumberFormat — never converts               │
└──────────────────────────────────────────────────────────────────────┘
```

The header — cover image, title, description — is server-known, so Liquid renders it into
the HTML where it paints with the document. React owns only the grid, which is the part
that genuinely has to wait for data.

Matching a product to its lookbooks is a **content** question the server can answer for
free from data already in the page render — no API round trip, no layout shift. Doing it
in React would mean shipping every lookbook's handle list to every browser and paying a
request to learn something Liquid already knew. Fetching product data is a **catalog**
question, and the brief assigns it to the Storefront API.

Full reasoning in [ADR-0003](docs/adr/0003-liquid-selects-react-fetches.md).

### The data model

One metaobject type, `lookbook`:

| Field             | Type                     | Purpose                                   |
| ----------------- | ------------------------ | ----------------------------------------- |
| `title`           | single line text         | Display heading                           |
| `description`     | rich text                | Intro copy                                |
| `product_handles` | list of single line text | **Handles only.** Order is display order. |
| `priority`        | integer                  | Lower wins when capping to two            |
| `cover_image`     | file reference           | Optional editorial image                  |

Handles rather than product references is a requirement of the brief, and it carries a
real cost — renaming a product handle silently drops it from every lookbook referencing
it. [ADR-0002](docs/adr/0002-handles-not-product-references.md) records the trade.

### The "maximum of two" rule

The brief caps product pages at two lookbooks but never says _which_ two, and "whichever
two Shopify returns" is not a rule — admin ordering is not a contract. So:

1. keep lookbooks whose `product_handles` contains this product's handle
2. sort ascending by `priority`
3. tie-break ascending by metaobject handle
4. take the first two

Steps 2 and 3 happen in a single string sort. Liquid has no sort-by-key for drops, so
each match is encoded as `PPPP:handle` — zero-padded priority, then handle — and sorted
lexicographically. The padding is what makes it numeric: without it `100` sorts before
`20`.

Implemented in `theme/snippets/lookbook-match.liquid` and tested by running **that actual
file** through `liquidjs`, not a JavaScript reimplementation of it.

### Market pricing

`localization.country.iso_code` → `@inContext(country:)`. Shopify resolves the market's
price-list overrides server-side, so amounts arrive already correct and the client only
formats them. Nothing in the bundle multiplies a price by anything.

The JPY figures are deliberately not conversions:

| Product             | Australia | Japan   | implied rate | compare-at rate |
| ------------------- | --------- | ------- | ------------ | --------------- |
| Camel Wool Overcoat | A$689     | ¥78,000 | 113.2        | 108.4           |
| Rust Bomber Jacket  | A$349     | ¥39,800 | 114.0        | **121.2**       |
| Monk Strap Shoe     | A$389     | ¥44,000 | 113.1        | 115.4           |

Rates differ per product, and on the same product the compare-at rate differs from the
price rate. No single conversion could produce those numbers — which is the point. It is
evidence the storefront reads market data rather than doing arithmetic.

`Intl.NumberFormat` takes decimal places from locale data, so AUD gets two and JPY gets
none: `¥19,800`, not `¥19,800.00`.

---

## Project structure

```
src/lookbook/            React island — the only code that gets bundled
  index.jsx                mount: finds [data-lookbook] nodes, hydrates each
  Lookbook.jsx             the product grid, and its loading / empty / error states
  ProductCard.jsx          image, vendor, title, price, compare-at
  useLookbookProducts.js   fetch lifecycle, abort on unmount
  styles.css               Tailwind entry: layers, @theme tokens, @source globs
  api/query.js             query construction + handle validation
  api/storefront.js        GraphQL client, batching, one retry
  lib/money.js             Intl.NumberFormat wrapper; never converts
  lib/sort.js              merchandiser ordering, missing-handle reporting

theme/
  sections/lookbook.liquid          home page — has the metaobject picker
  sections/lookbook-product.liquid  product page — no picker
  snippets/lookbook-mount.liquid    shared settings + mount markup
  snippets/lookbook-match.liquid    the max-two rule
  assets/lookbook.{js,css}          BUILD OUTPUT — committed, never hand-edited

scripts/setup/           idempotent Admin API setup
tests/unit/              money, sort, query, client, components
tests/liquid/            the max-two rule, run through liquidjs
docs/adr/                architecture decision records
```

---

## Testing

97 tests. Coverage thresholds are enforced in CI at 80% of `src/`.

| Level     | What it covers                                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | JPY zero-decimal formatting; compare-at only when strictly higher; handle validation rejecting GraphQL injection; batching; retry-once; GraphQL errors arriving with HTTP 200 |
| Component | loading / empty / error states; merchant diagnostics in the theme editor; static Tailwind column classes                                                                      |
| Liquid    | the max-two rule against the real `.liquid` file — priority order, numeric-vs-lexicographic padding, handle tie-breaks, 0/1/3 membership                                      |

The two things most likely to be probed in review — the max-two rule and market pricing —
are tested directly rather than incidentally.

**No end-to-end suite.** The store is password-protected, so browser tests would need the
storefront password as a secret, and tests that cannot be run are worse than none. Three
flows would be worth covering once that is available: the home page rendering its selected
lookbook from a network call rather than from the HTML; the product page for
`rust-bomber-jacket` rendering exactly two lookbooks; and switching market to Japan
changing prices to JPY at price-list values. All three are verifiable by hand today —
see the checklist in `docs/runbooks/store-setup.md`.

---

## Notes for a reviewer

**Where to look first.** `theme/snippets/lookbook-match.liquid` is the heart of the
feature; `tests/liquid/lookbook-match.test.js` proves it.

**Build output is committed.** Shopify serves `theme/assets/` from what `theme push`
uploads, so the built files must exist in the repo. `npm run verify:bundle` rebuilds from
scratch in CI and fails if anything drifted — otherwise the storefront can quietly run
code the diff does not describe.

**Failure behaviour is deliberate.** A lookbook that cannot render removes itself on the
storefront rather than leaving a heading above blank space. In the theme editor the same
conditions are spelled out, including which handles no longer match a published product.

**Known limitation.** On this development store, `availableForSale` comes back `false`
for every product under `@inContext(country:)`, while being `true` with no market context
and `true` in the Admin API. Market-context availability resolves against a market web
presence, which a dev store with no configured domains does not have. Prices are
unaffected. Stock status is not part of this brief, so the card does not render a
sold-out badge rather than render a wrong one; the field remains in the query for a real
store.

---

## Decisions

- [ADR-0001 — A build step for the React island](docs/adr/0001-react-island-build-step.md)
- [ADR-0002 — Handles, not product references](docs/adr/0002-handles-not-product-references.md)
- [ADR-0003 — Liquid selects, React fetches](docs/adr/0003-liquid-selects-react-fetches.md)
- [ADR-0004 — Tailwind without Preflight](docs/adr/0004-tailwind-without-preflight.md)

Store setup from zero: [`docs/runbooks/store-setup.md`](docs/runbooks/store-setup.md).
For merchandisers: [`docs/client-training/managing-lookbooks.md`](docs/client-training/managing-lookbooks.md).
