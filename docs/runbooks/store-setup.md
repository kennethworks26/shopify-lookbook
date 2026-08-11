# Runbook: standing up the store from zero

Everything needed to reproduce `convert-digital-john-kenneth-fernandez.myshopify.com` on
a fresh development store. Roughly 30 minutes, most of it waiting.

The order matters in two places, both called out below.

> **Note on admin paths.** Shopify's admin navigation shifts between releases. Where a
> path here does not match what you see, the setting still exists — search for it by name
> in the admin's search bar. Paths verified against the 2026 admin.

---

## 1. Create the development store

Partner dashboard → **Stores** → **Create store** → **Dev**.

| Field | Choose | Why |
| --- | --- | --- |
| Store name | anything | Becomes the permanent `.myshopify.com` domain |
| Shopify plan | **Advanced** | Free on a dev store. Guarantees the full Markets feature set, including per-market catalogs and price lists. |
| Generate test data | **off** | Prefab data is noise, and it hides which content is yours |

Development stores are free and unlimited, but they are password-protected and cannot
take real payments.

## 2. Make the store Australian

**Settings → General.**

| Setting | Set to |
| --- | --- |
| Currency display → ⋯ → Change store currency | **Australian Dollar (AUD $)** |
| Store address | Australia |
| Unit system | Metric, kilograms |
| Time zone | (GMT+10:00) Melbourne |

**Do this before seeding prices** if you can — though it is not fatal if you forget.
Changing store currency *relabels* existing prices rather than converting them, so a
product seeded at `229.00` becomes `A$229.00`. No reseed needed.

## 3. Activate a payment provider

**Settings → Payments → Activate the test payment provider → Activate.**

This looks unrelated and is not. **Shopify refuses to create a second market currency
without an active payment provider**, so `npm run setup:markets` fails at the Japan
market with:

> The shop's payment gateway does not support enabling more than one currency.

The test gateway satisfies this and gives the store a working checkout. It needs no
financial details.

## 4. Create the custom app

**Settings → Apps and sales channels → Develop apps.**

On a store created after 1 January 2026 you must first click **Allow custom app
development**. This is irreversible, and harmless on a dev store.

Then **Create a legacy custom app**, named **`Lookbook Feature`**.

> The name matters. `scripts/setup/catalog.mjs` looks up the app's sales channel by this
> exact name. If you name it something else, change `APP_CHANNEL` in that file to match.

### Admin API scopes

**Configuration → Admin API integration.** Ticking a `write_` scope selects its `read_`
counterpart automatically, so tick these six:

| Scope | Needed for |
| --- | --- |
| `write_products` | seeding the catalog |
| `write_metaobject_definitions` | creating the lookbook schema |
| `write_metaobjects` | creating lookbook entries |
| `write_markets` | AU and JP markets, catalogs, price lists |
| `write_publications` | publishing products to sales channels |
| `write_inventory` | turning inventory tracking off |

Plus `read_themes` on its own, for verification. Thirteen selected in total. Save.

### Storefront API scopes

**Configuration → Storefront API integration.** Tick exactly one:

- `unauthenticated_read_product_listings`

Save, then **Install app**.

### Copy the credentials

**API credentials.**

- **Admin API access token** — revealed **once**. Copy it now. This is secret.
- **Storefront API access token** — always visible. Public by design.

```bash
cp .env.example .env
```

Fill in `SHOPIFY_STORE`, both tokens, and leave `SHOPIFY_API_VERSION=2026-07`.

## 5. Seed the store

```bash
npm install
npm run setup:metaobjects   # the lookbook definition
npm run setup:catalog       # 11 products with imagery, published to both channels
npm run setup:lookbooks     # 3 overlapping lookbooks
npm run setup:markets       # Australia + Japan, JPY price list
```

Order matters here: lookbooks reference product handles, and the JPY price list
references variant IDs, so the catalog must exist first.

Every script is idempotent. Run them twice to confirm — the second run should report
`unchanged` rather than creating duplicates.

`setup:catalog` also deletes demo products it previously created that are no longer
declared in the script. It is scoped strictly to its own `lookbook-demo` tag, so it
cannot touch anything else.

## 6. Build and push the theme

```bash
npm run build
npx shopify theme push --path theme --unpublished --theme "Lookbook" --store <your-store>.myshopify.com
```

`--theme` is required when running non-interactively, otherwise the CLI stops to ask for
a name.

Note the theme id it prints — later pushes take `--theme <id>` to update in place rather
than creating another copy.

## 7. Set the Storefront token in the theme

**Online Store → Themes → Lookbook → Customize → Theme settings → Storefront API.**

Paste the **Storefront** token — never the Admin one. Save.

`theme/config/settings_data.json` is gitignored precisely because it holds this value:
it is store-specific, and committing it would mean anyone pushing this theme elsewhere
silently ships a token pointing at a different shop.

Without a token the sections render nothing to customers and say why in the editor.

## 8. Place the sections

**Home page** — in the theme editor, add the **Lookbook** section and choose a lookbook
in its settings. (`templates/index.json` in this repo already has Autumn Layers
selected, so a fresh push arrives configured.)

**Product page** — add the **Lookbook (product page)** section. It has no picker; it
resolves lookbooks from the product being viewed.

## 9. Verify

```bash
npm run lint && npm test && npm run verify:bundle
```

Then, on the storefront:

| Check | Expect |
| --- | --- |
| Home page | Autumn Layers, five products, prices in A$ |
| Network tab | a request to `/api/2026-07/graphql.json` — product data arrives at runtime, not in the HTML |
| `/products/rust-bomber-jacket` | exactly **two** lookbooks: Autumn Layers and Weekend Edit |
| Switch market to Japan | prices become ¥, zero decimals, at price-list values — not conversions |
| A product in no lookbook | nothing on the storefront; guidance in the theme editor |

---

## Things that go wrong

**The Storefront API returns an empty product list, with a valid 200 and no error.**
The products are not published to the custom app's own sales channel. A custom app's
Storefront token sees only products published to *that app's* channel — not merely
anything on the Online Store. The admin will show the products as published and live
throughout. `setup:catalog` publishes to both channels and fails loudly if the app
channel is missing.

**`npm run setup:markets` fails on the Japan market.** No active payment provider — see
step 3.

**The theme pushes "with errors" and templates complain that a section file does not
exist.** The section itself failed schema validation and was never uploaded; the template
error is a symptom. Read past it to the section error above it in the output. `shopify
theme check` does not catch every schema rule the server enforces — range settings
needing at least three steps, for instance.

**Everything renders as "Sold out".** Variants have no inventory. Both
`inventoryItem: { tracked: false }` **and** `inventoryPolicy: CONTINUE` are needed;
turning tracking off alone still leaves Shopify refusing a sale at zero quantity.

**Descriptions render as raw JSON.** A `rich_text_field` outputs its JSON document when
rendered directly. Use `| metafield_tag`.
