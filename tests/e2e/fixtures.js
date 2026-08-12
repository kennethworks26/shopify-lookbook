/**
 * Shared guards for the end-to-end suite.
 *
 * Every spec calls `requireStore()` first. Without a configured store the tests
 * skip rather than fail: a fork has no secrets, and a contributor who has never
 * seen this store should get a green run, not a wall of red from something they
 * cannot fix.
 */
import { test } from '@playwright/test';

export const STORE_URL = process.env.SHOPIFY_STORE_URL;
export const STORE_PASSWORD = process.env.SHOPIFY_STORE_PASSWORD;

/** The product deliberately placed in all three lookbooks by setup:lookbooks. */
export const ANCHOR_PRODUCT = 'rust-bomber-jacket';

/** The two that must win on its product page, and the one that must not. */
export const EXPECTED_LOOKBOOKS = ['Autumn Layers', 'Weekend Edit'];
export const EXCLUDED_LOOKBOOK = 'Monochrome Study';

export function requireStore() {
  test.skip(!STORE_URL, 'SHOPIFY_STORE_URL is not set — see playwright.config.js');
}
