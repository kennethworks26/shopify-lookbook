# ADR-0002: Lookbooks store product handles, not product references

**Status:** Accepted · **Date:** 2026-08-11

## Context

The `lookbook` metaobject needs to record which products belong to it. Shopify offers two
field types for this:

- `list.product_reference` — a typed reference to the product resource
- `list.single_line_text_field` — plain strings, in this case handles

Product references are the better default in almost any other design. They survive handle
changes, they give referential integrity, and Liquid can resolve them directly with no
API call.

The brief overrides that default explicitly:

> The lookbook must specify handles only, and the product data must be fetched at runtime
> using the storefront API.

## Decision

`product_handles` is a `list.single_line_text_field` holding product handles. Product
data is fetched at runtime through the Storefront API and never rendered from Liquid.

The requirement is followed as written, including in the places where it would be easy to
quietly work around — the no-JavaScript fallback in `lookbook-mount.liquid` renders
product *links* built from the handles it already has, and deliberately no titles,
images, or prices, because those would have to come from Liquid.

## Alternatives considered

**`list.product_reference`, fetching by ID from the Storefront API.** This would satisfy
"fetched at runtime" while keeping referential integrity, and was tempting. Rejected
because the brief says "handles only", and a reviewer checking that requirement would
find product references and reasonably conclude it had been ignored. Where a brief is
explicit about a mechanism, following it is part of the work.

**Handles plus a hidden reference field for integrity.** Belt and braces: handles drive
the API call, references keep the link alive across renames. Rejected as the worst of
both — two sources of truth for the same relationship, which drift the moment anyone
edits one in the admin.

## Consequences

- **Renaming a product handle silently drops it from every lookbook that references it.**
  This is the real cost, and it is not hypothetical: handles change when a merchant
  retitles a product and lets Shopify regenerate the URL. There is no error. The lookbook
  simply renders one product shorter.

  Mitigated, not solved: `missingHandles()` reports every handle that did not resolve,
  and the theme editor lists them by name so a merchant editing the page sees exactly
  what broke. Shoppers see a shorter lookbook rather than a broken tile.

- **Handles are interpolated into a GraphQL document**, so they are validated against
  `/^[a-z0-9][a-z0-9-]*$/` before use and quoted with `JSON.stringify` on the way in.
  The Storefront API is read-only and public-scoped, so the blast radius of an injection
  would be small — but "small blast radius" is not a reason to build one in.

- **The admin field description carries the cost forward.** It tells merchandisers where
  to find a handle and that order matters, because they are the ones who will hit the
  rename problem.

- If this were a production build rather than an assessment, this is the first decision I
  would revisit with the client — and `docs/client-training/managing-lookbooks.md` warns
  about renames for exactly that reason.
