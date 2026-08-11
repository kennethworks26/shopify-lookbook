# ADR-0004: Tailwind 4 in the island, imported without Preflight

**Status:** Accepted · **Date:** 2026-08-11

## Context

Tailwind CSS 4 styles the lookbook island. The obvious entry point is one line:

```css
@import 'tailwindcss';
```

That pulls in three layers: `theme` (design tokens), `utilities` (the utility classes),
and `preflight` — a global reset that normalises margins, heading sizes, list styling,
border defaults, and more across every element on the page.

The complication is where this stylesheet ends up. It is loaded by a *section*. A section
owns one region of one page. The theme owns its own base styles in `assets/base.css`, and
the header, footer, and product information section are all plain Liquid and hand-written
CSS that know nothing about Tailwind.

## Decision

Import the layers selectively, leaving Preflight out:

```css
@layer theme, base, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
```

Design tokens live in `@theme` in the same file — Tailwind 4 is CSS-first, so there is no
`tailwind.config.js`.

## Alternatives considered

**Import Preflight and let the theme adapt.** Reasonable if Tailwind owned the whole
theme. Here it would mean a stylesheet shipped by one section restyling every other
section on the page — a section reaching well outside its own boundary. Any future
section added by another developer would inherit a reset it never asked for, from a file
whose name suggests it only concerns lookbooks.

**Import Preflight but scope it under a wrapper class.** Possible with `@layer` and a
parent selector, but Preflight targets bare element selectors, so scoping it means
rewriting it. The maintenance burden lands on whoever next upgrades Tailwind.

**Use Tailwind for the whole theme.** Defensible on a project where the team already
lives in Tailwind. Rejected here because it would put a build step in front of every
stylesheet in the theme to serve one section, and ADR-0001 exists to keep that blast
radius small. This is a judgement about *this* theme, not a claim that Tailwind is wrong.

## Consequences

- **Utility classes work; element defaults do not change.** Anything the island needs
  beyond utilities — the reduced-motion block, for instance — is written explicitly in
  `styles.css`.

- **`@source` globs are mandatory.** Tailwind discovers utilities by scanning source
  files. It finds JSX through the Vite plugin's module graph, but Liquid is invisible to
  it — nothing in JavaScript ever imports a `.liquid` file. Without

  ```css
  @source '../../theme/sections/lookbook*.liquid';
  @source '../../theme/snippets/lookbook-*.liquid';
  ```

  any class used only in Liquid is purged from the production build. The failure is
  particularly unpleasant: dev looks correct, production renders unstyled.

- **Class names cannot be constructed at runtime.** `` `grid-cols-${n}` `` produces
  classes that exist when the component runs but were never seen at build time, so they
  are purged and the grid silently collapses to one column in production. `Lookbook.jsx`
  therefore maps column counts to complete static class strings, and a test asserts it.

- **Tokens are namespaced.** `--color-lookbook-ink`, `--color-lookbook-sale` and so on,
  so utilities generated for this island read as belonging to it and cannot be confused
  with theme-wide values.

- The compiled stylesheet is small — under 8 kB uncompressed, around 2 kB gzipped —
  because only the utilities actually used are emitted, and no reset ships at all.
