#!/usr/bin/env node
/**
 * Fail if the committed build output does not match what the current source builds.
 *
 * Committing build output is a deliberate tradeoff. Shopify serves `theme/assets/`
 * straight from what `shopify theme push` uploads, so the built files have to exist
 * in the repo — but committed artifacts drift the moment someone edits source and
 * forgets to rebuild. When that happens the storefront keeps running yesterday's
 * code while the diff claims otherwise, which is a genuinely nasty thing to debug.
 *
 * This runs in CI. It rebuilds from scratch and asks git whether anything moved.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ARTIFACTS = ['theme/assets/lookbook.js', 'theme/assets/lookbook.css'];

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

console.log('Rebuilding to compare against committed output…');

try {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
} catch {
  fail('Build failed. Fix the build before checking for drift.');
}

const missing = ARTIFACTS.filter((file) => !existsSync(file));
if (missing.length > 0) {
  fail(`Build did not produce: ${missing.join(', ')}`);
}

const dirty = run('git', ['status', '--porcelain', '--', ...ARTIFACTS]);

if (dirty) {
  const files = dirty
    .split('\n')
    .map((line) => line.slice(3))
    .join('\n  ');

  fail(
    `Committed build output is stale:\n\n  ${files}\n\n` +
      'Source changed without a rebuild, so the storefront would serve older code\n' +
      'than this branch describes. Run `npm run build` and commit the result\n' +
      'alongside the source change that caused it.'
  );
}

console.log('✓ Committed build output matches source.');
