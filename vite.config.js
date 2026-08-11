import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Build config for the lookbook React island.
 *
 * This is deliberately the only build in the repo. Everything else in `theme/` —
 * Liquid, base CSS, any other script — is served to the browser exactly as it sits
 * in version control. See docs/adr/0001-react-island-build-step.md.
 *
 * Two constraints come from Shopify rather than from Vite:
 *
 *   1. Asset filenames must be stable. Shopify resolves assets through
 *      `{{ 'lookbook.js' | asset_url }}`, so a content hash in the filename would
 *      break the reference on every build. Cache busting is Shopify's job — it
 *      appends its own version query string when serving from the CDN.
 *
 *   2. `theme/assets/` is not ours alone, so `emptyOutDir` stays off. Wiping it
 *      would delete hand-written theme assets that this build knows nothing about.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  /*
   * React selects its development or production build by reading
   * `process.env.NODE_ENV`. In library mode Vite does not substitute that for us, so
   * without this define we ship React's development build: roughly 4x the bytes,
   * plus dev-only warnings and invariant checks running in front of every shopper.
   *
   * Symptom to watch for if this is ever removed: `npm run build` reporting a
   * lookbook.js near 600 kB rather than ~190 kB.
   */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'theme/assets',
    emptyOutDir: false,
    // The island ships standalone: React is bundled in, not loaded from a CDN.
    // A third-party CDN would be an external runtime dependency, which sits badly
    // against the brief's "native Shopify features only" constraint.
    lib: {
      entry: 'src/lookbook/index.jsx',
      name: 'ShopifyLookbook',
      formats: ['iife'],
      fileName: () => 'lookbook.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'lookbook.[ext]',
      },
    },
    // Source maps would leak into theme/assets and get served publicly.
    sourcemap: false,
    target: 'es2020',
  },
});
