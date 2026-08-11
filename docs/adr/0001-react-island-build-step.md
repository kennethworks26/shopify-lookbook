# ADR-0001: A build step for the React island, and nothing else

**Status:** Accepted · **Date:** 2026-08-11

## Context

A Shopify theme does not need a bundler. Shopify serves `theme/assets/*` straight from
its CDN, and `shopify theme dev` reloads whatever is on disk. That is a genuine virtue:
the file in the repo is byte-for-byte the file the browser receives, so debugging in
devtools lands on real source and there is no build to go stale or fail.

The brief removes that option. It requires lookbooks to render with React, and this
project also uses Tailwind CSS 4. Both need a compile pass.

## Decision

One Vite build, scoped to `src/lookbook/` only. It emits exactly two files:
`theme/assets/lookbook.js` and `theme/assets/lookbook.css`. Both are committed.

Everything else in `theme/` — all Liquid, `assets/base.css` — stays build-free and is
served exactly as committed.

## Alternatives considered

**No build at all: Preact with `htm`.** Tagged template literals instead of JSX, loaded
as an ES module. Preserves the no-build property entirely. Rejected because the brief
says React, and a reviewer checking that requirement should not have to accept an
argument about why Preact is close enough.

**React with `htm` from a CDN.** Real React, no bundler. Rejected on two counts: it makes
the storefront depend on a third-party host at runtime, which sits badly against "native
Shopify features only", and it puts a DNS lookup plus an uncached request on the critical
path of a section that also has an API call to make.

**Two builders — esbuild for JS, the Tailwind CLI for CSS.** Workable, and each piece is
simpler than Vite. Rejected because two build commands have to be kept in step by hand,
and the failure mode is a stylesheet that silently lags the markup it styles.

**Not committing the build output.** Cleaner history, no generated code in diffs. Rejected
because Shopify serves what `theme push` uploads, so the built files have to exist
somewhere the push can see. Building in CI and pushing from CI would work on a larger
team; for a single-developer assessment it adds a moving part without removing one.

## Consequences

- **Committed artifacts drift.** Someone edits source, forgets to rebuild, and the
  storefront runs yesterday's code while the diff claims otherwise. `npm run
  verify:bundle` rebuilds from scratch in CI and fails if git sees any movement in the
  two artifacts. That gate exists from the first commit that produced a bundle, not
  bolted on afterwards.

- **`process.env.NODE_ENV` must be defined explicitly.** Vite does not substitute it in
  library mode, and React picks its development or production build by reading it.
  Without the `define` in `vite.config.js` the theme ships React's development build:
  595 kB instead of 202 kB, with dev-only warnings and invariant checks running in front
  of every shopper. The symptom is documented in the config so it cannot regress
  silently.

- **Asset filenames must be stable.** Shopify resolves assets through
  `{{ 'lookbook.js' | asset_url }}`, so a content hash in the filename would break the
  reference on every build. Cache busting is Shopify's job — it appends its own version
  query string at the CDN.

- **`emptyOutDir` stays off.** `theme/assets/` also holds hand-written files this build
  knows nothing about, and wiping the directory would delete them.

- The blast radius stays small: exactly one directory compiles, and a reviewer can read
  every other file in the theme as-is.
