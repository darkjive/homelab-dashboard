import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  // Frontend: browser environment + React rules
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React-Compiler-backed rules shipped as errors in eslint-plugin-react-hooks 7.x.
      // Every widget uses the mount-fetch pattern (effect calls an async loader that
      // flips `loading` synchronously), which these flag wholesale. Downgraded to
      // warnings so lint stays actionable; see TODO.md for the planned refactor.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  // Backend + tooling: Node environment, no React rules
  {
    files: ['server/**/*.ts', 'vite.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
]);
