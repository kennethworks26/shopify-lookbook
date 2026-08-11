# Managing lookbooks

For the person curating lookbooks. No developer needed — you can create a lookbook and
put it on the site yourself.

---

## What a lookbook is

A named set of products shown together. You build it once, and it can appear in two
places:

- **On the home page**, where you choose exactly which lookbook to show.
- **On product pages**, automatically. If a product is in a lookbook, that lookbook can
  appear on its page.

---

## Creating a lookbook

**Content → Metaobjects → Lookbooks → Add entry.**

| Field               | What to put in it                                     |
| ------------------- | ----------------------------------------------------- |
| **Title**           | The heading shoppers see, e.g. _Autumn Layers_        |
| **Description**     | A sentence or two under the heading. Optional.        |
| **Product handles** | One handle per line, in the order you want them shown |
| **Priority**        | A number. Lower numbers win — see below.              |
| **Cover image**     | Optional editorial image for the lookbook             |

### Finding a product's handle

A handle is the last part of a product's web address.

```
https://your-store.myshopify.com/products/rust-bomber-jacket
                                           ^^^^^^^^^^^^^^^^^
                                           this is the handle
```

You can also see it on the product page in the admin, under **Search engine listing →
Edit**, in the URL field.

Handles are always lowercase with hyphens. No capitals, no spaces.

### Order matters

Products appear on the storefront in the order you list them here. Put the piece you most
want seen first — it lands top-left, which is where eyes go.

---

## Putting a lookbook on the home page

**Online Store → Themes → Customize.**

1. Make sure you are on the **Home page** (top dropdown).
2. **Add section → Lookbook**.
3. In the section's settings, click **Select** next to _Lookbook_ and pick yours.
4. **Save**.

You can adjust columns, whether prices show, spacing, and so on. If you leave the
lookbook unselected, shoppers see nothing at all — and the editor tells you so.

---

## Lookbooks on product pages

This one is automatic and works differently, so it is worth understanding.

Add the **Lookbook (product page)** section once, to the product template. There is no
lookbook picker on it — and that is deliberate. Which lookbooks are relevant depends on
the product being viewed, not on a choice you make when placing the section.

From then on, any product that belongs to a lookbook will show it on its page.

### Why only two show

**A product page shows at most two lookbooks**, even if the product is in five.

When there are more than two, the ones with the **lowest priority numbers** win.

Worked example — _Rust Bomber Jacket_ is in all three:

| Lookbook         | Priority | Shows on the product page? |
| ---------------- | -------- | -------------------------- |
| Autumn Layers    | 10       | Yes                        |
| Weekend Edit     | 20       | Yes                        |
| Monochrome Study | 30       | No — third place           |

To promote _Monochrome Study_ on that page, give it a lower number than 20.

**Use 10, 20, 30 rather than 1, 2, 3.** That leaves room to slot a new lookbook between
two existing ones later without renumbering everything.

If two lookbooks share the same priority, they are ordered alphabetically — so the result
is always predictable, never random.

---

## Things worth knowing

**Renaming a product removes it from lookbooks.** This is the one real trap. If you
rename a product and let Shopify update its web address, the handle changes — and any
lookbook still listing the old handle quietly drops that product. Nothing breaks visibly;
the lookbook is just one product shorter.

If you rename a product, update the handle in every lookbook that lists it. The theme
editor helps: open the page and it will tell you which handles no longer match a product.

**Unpublished and deleted products disappear too**, for the same reason. That part is
usually what you want.

**Shoppers never see an error.** If a lookbook cannot be shown — nothing selected, no
products matching, a technical problem — the section removes itself from the page
entirely rather than leaving an empty gap. Warnings appear only in the theme editor, only
for you.

**Prices look after themselves.** A shopper in Australia sees Australian dollars, one in
Japan sees yen, at the prices set for that market. You do not need to do anything per
market when building a lookbook.

---

## Quick checks

| You want to                             | Do this                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| Add a product to a lookbook             | Content → Metaobjects → Lookbooks → edit → add its handle |
| Reorder products                        | Reorder the handles                                       |
| Swap which lookbook is on the home page | Themes → Customize → Lookbook section → Select            |
| Change which two show on product pages  | Adjust the **Priority** numbers                           |
| See why a product is missing            | Open the page in Themes → Customize and read the notice   |
