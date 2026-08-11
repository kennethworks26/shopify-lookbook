import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Test config is kept separate from vite.config.js because that file is in library
 * mode, building a single IIFE for the theme. Reusing it here would drag those
 * build options into the test run for no benefit.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      // The mount entrypoint is exercised end-to-end by Playwright, not by jsdom:
      // it reads real DOM emitted by Liquid, which a unit test would have to fake.
      exclude: ['src/lookbook/index.jsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
