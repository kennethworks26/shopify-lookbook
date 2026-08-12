import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a real Shopify storefront.
 *
 * These are the only tests that prove the whole chain works: Liquid selecting
 * lookbooks, the island hydrating, the Storefront API answering, and market
 * pricing resolving. Everything else in the suite tests one layer in isolation.
 *
 * They need a live store, so they are configured entirely from the environment
 * and skip themselves when it is absent — see tests/e2e/fixtures.js. A developer
 * who has never seen this store, or a fork with no secrets, gets skips rather
 * than failures.
 *
 *   SHOPIFY_STORE_URL       https://your-store.myshopify.com
 *   SHOPIFY_STORE_PASSWORD  storefront password, if the store is protected
 */
const baseURL = process.env.SHOPIFY_STORE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  // Each spec asserts on independent pages, so they can run together.
  fullyParallel: true,
  // A live third-party storefront occasionally hiccups; one retry locally, two
  // in CI, distinguishes a real regression from a blip.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  // Generous: these wait on a real API over a real network, not a local server.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    // Only kept for failures — passing runs leave nothing behind.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Signs in past the storefront password once and saves the cookie, so every
    // spec starts authenticated instead of repeating the form post.
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/state.json' },
      dependencies: ['setup'],
    },
  ],
});
