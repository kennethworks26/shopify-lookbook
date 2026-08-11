import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      // Build output. Linting it would report on generated code we never edit.
      'theme/assets/lookbook.js',
    ],
  },

  js.configs.recommended,

  // React island — runs in the browser.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '19.0' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // React 19 with the automatic JSX runtime: React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      // React 19 removed runtime propTypes support entirely, so this rule now asks
      // for a feature that no longer exists. Prop shapes are documented in JSDoc and
      // enforced by the component tests instead.
      'react/prop-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // Hand-written theme scripts. Served to the browser exactly as committed —
  // these are not bundled, so no JSX and no module syntax. The build output
  // (assets/lookbook.js) is ignored above.
  {
    files: ['theme/assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: globals.browser,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // Setup scripts and build tooling — run in Node.
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // These scripts are operator-facing; their console output is the interface.
      'no-console': 'off',
    },
  },

  // Tests.
  {
    files: ['tests/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    settings: { react: { version: '19.0' } },
    rules: {
      // Without jsx-uses-vars, a component imported solely to be rendered as JSX
      // reads as an unused variable.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
