# ADR-0003: Liquid selects which lookbooks render; React fetches what is in them

**Status:** Accepted · **Date:** 2026-08-11

## Context

Two questions have to be answered before a lookbook can appear on a product page:

1. **Which lookbooks contain this product?** — and, when there are more than two, which
   two win.
2. **What are those products called, what do they look like, and what do they cost in
   this shopper's market?**

Both could be answered in either layer. The brief fixes half of it: product data must
come from the Storefront API at runtime. It says nothing about where matching happens.

## Decision

**Liquid answers question 1. React answers question 2.**

Liquid iterates `shop.metaobjects.lookbook.values`, keeps those whose `product_handles`
contains `product.handle`, sorts by `priority` with a handle tie-break, takes the first
two, and emits one mount node per surviving lookbook carrying its handles as JSON in a
`data-lookbook` attribute.

React reads that attribute and makes one Storefront API request per lookbook.

## Alternatives considered

**Match in React.** Ship every lookbook's handle list to the browser, then filter
client-side. Rejected on three counts:

- It sends every lookbook in the shop to every visitor of every product page. That grows
  with the catalog, and most of it is discarded immediately.
- It costs a round trip to learn something the server already knew, so the section cannot
  render its heading until the network answers.
- The heading and the grid then arrive together, late, which is a layout shift on a
  section that is mostly images.

**Match in Liquid, render everything in Liquid.** No API call at all. Rejected: the brief
requires runtime fetching, and this is precisely the shortcut it exists to rule out.

**Match server-side in a theme app extension or app proxy.** More architecturally
"correct" in a large build, and lets the matching live in real code rather than Liquid
string manipulation. Rejected as disproportionate — it adds an app, a deployment target,
and a network hop to answer a question Liquid can answer for free during a render it is
already doing.

## Consequences

- **The heading paints immediately.** Title and description are server-known, so they are
  in the HTML. Only the product grid waits on the network, and it renders skeleton tiles
  sized from the handle count so the space is reserved.

- **Matching logic lives in Liquid**, which has no sort-by-key for drops. The rule is
  therefore encoded as a string sort over `PPPP:handle` values. That is less readable
  than the equivalent JavaScript, which is why the snippet carries a long comment
  explaining the encoding and why the zero-padding matters.

- **The rule needs testing where it lives.** `tests/liquid/lookbook-match.test.js` runs
  the real `.liquid` file through `liquidjs` with `lookbook-mount` stubbed. Testing a
  JavaScript reimplementation would have passed happily while the shipped Liquid drifted
  away from it — and this is the behaviour most likely to be checked in review.

- **Selection and rendering are in the same snippet.** Liquid's `render` cannot return a
  value, so a snippet that only *computed* the matches would leave its caller unable to
  see them. The alternative — computing in the snippet and again in the section — is
  exactly how two implementations of "max two" drift apart. So `lookbook-match.liquid`
  owns both.

- **Each island is independent.** A product page can hold two lookbooks; they hydrate
  separately and one failing does not take the other down.
