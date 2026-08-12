#!/usr/bin/env node
/**
 * Start the Shopify theme development server.
 *
 * Wraps `shopify theme dev` so the store and its password come from .env rather
 * than from flags typed by hand or prompts. Development stores cannot turn
 * password protection off, so without the password the CLI stops and waits —
 * which is fine in a terminal and fatal in anything that pipes output.
 *
 * Usage: npm run dev
 */
import { spawn } from 'node:child_process';
import { loadEnv, fail, log } from './setup/lib/admin.mjs';

const env = loadEnv();

const args = [
  'shopify',
  'theme',
  'dev',
  '--path',
  'theme',
  '--store',
  env.SHOPIFY_STORE,
  // `--theme-editor-sync` is deliberately not passed. It is an opt-in boolean, and
  // enabling it lets the theme editor write back over local files mid-session —
  // so the working tree is only ever changed by you.
];

if (env.SHOPIFY_STORE_PASSWORD) {
  args.push('--store-password', env.SHOPIFY_STORE_PASSWORD);
} else {
  log.info('SHOPIFY_STORE_PASSWORD is not set — the CLI will prompt for it.');
}

log.step(`Theme dev server for ${env.SHOPIFY_STORE}`);
log.info('Run `npm run build:watch` alongside this to rebuild the island on change.');

const child = spawn('npx', args, { stdio: 'inherit' });

child.on('error', (error) => fail(`Could not start the Shopify CLI: ${error.message}`));
child.on('exit', (code) => process.exit(code ?? 0));
