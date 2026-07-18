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
