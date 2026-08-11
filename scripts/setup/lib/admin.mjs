/**
 * Shared Admin API client for the setup scripts.
 *
 * These scripts run on a developer's machine, never in the theme. The token they
 * use can read and write the entire store, which is exactly why it lives in .env
 * and never reaches anything Shopify serves to a browser.
 *
 * Every script built on this is idempotent: running it twice must leave the store
 * in the same state as running it once. Store setup gets re-run — after a mistake,
 * on a fresh store, or by a reviewer reproducing the build — and a script that only
 * works against a blank store is a script nobody can trust.
 */
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = ['SHOPIFY_STORE', 'SHOPIFY_API_VERSION', 'SHOPIFY_ADMIN_API_ACCESS_TOKEN'];

/**
 * Read .env without pulling in a dependency for twenty lines of parsing.
 */
export function loadEnv(file = '.env') {
  const fullPath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(fullPath)) {
    fail(`Missing ${file}. Copy .env.example to .env and fill it in.`);
  }

  const env = {};

  for (const line of fs.readFileSync(fullPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    fail(`${file} is missing: ${missing.join(', ')}`);
  }

  return env;
}

/**
 * Build a GraphQL caller bound to the store in .env.
 */
export function createClient(env = loadEnv()) {
  const endpoint = `https://${env.SHOPIFY_STORE}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

  return async function query(document, variables = {}) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: document, variables }),
    });

    if (response.status === 429) {
      // Shopify throttles on a leaky bucket. Seeding a catalog can outrun it.
      await sleep(2000);
      return query(document, variables);
    }

    if (!response.ok) {
      throw new Error(`Admin API ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();

    // GraphQL reports errors with HTTP 200, so a healthy status is not success.
    if (payload.errors?.length) {
      throw new Error(`Admin API: ${payload.errors.map((e) => e.message).join('; ')}`);
    }

    return payload.data;
  };
}

/**
 * Shopify returns mutation failures as `userErrors` inside a 200 response rather
 * than as GraphQL errors, so every mutation has to be checked explicitly. Missing
 * this is the classic way a seed script reports success while writing nothing.
 */
export function assertNoUserErrors(result, label) {
  const errors = result?.userErrors ?? [];

  if (errors.length > 0) {
    const detail = errors
      .map((e) => `${(e.field ?? []).join('.') || '(none)'}: ${e.message}`)
      .join('\n  ');

    throw new Error(`${label} failed:\n  ${detail}`);
  }

  return result;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Console helpers. These scripts are operator-facing; their output is the interface. */
export const log = {
  step: (message) => console.log(`\n▸ ${message}`),
  created: (message) => console.log(`  + created  ${message}`),
  updated: (message) => console.log(`  ~ updated  ${message}`),
  skipped: (message) => console.log(`  = unchanged ${message}`),
  info: (message) => console.log(`    ${message}`),
  done: (message) => console.log(`\n✓ ${message}\n`),
};

export function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
