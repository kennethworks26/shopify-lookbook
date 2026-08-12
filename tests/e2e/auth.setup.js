/**
 * Sign in past the storefront password once, and save the session for every
 * other spec.
 *
 * Development stores are always password protected and the protection cannot be
 * turned off, so this is unavoidable rather than incidental. Doing it once in a
 * setup project keeps it out of the tests, which are then free to describe
 * behaviour rather than plumbing.
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { STORE_PASSWORD, requireStore } from './fixtures.js';

const STATE = 'tests/e2e/.auth/state.json';

setup('authenticate', async ({ page }) => {
  requireStore();

  fs.mkdirSync(path.dirname(STATE), { recursive: true });

  await page.goto('/');

  // Shopify redirects to /password when the gate is up. If it did not, the store
  // is open and there is nothing to do.
  if (page.url().includes('/password') && STORE_PASSWORD) {
    await page.getByLabel(/password/i).fill(STORE_PASSWORD);
    await page.getByRole('button', { name: /enter/i }).click();
    await expect(page).not.toHaveURL(/\/password/);
  }

  await page.context().storageState({ path: STATE });
});
