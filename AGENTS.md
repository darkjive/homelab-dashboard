# AGENTS.md

High-signal notes for OpenCode sessions. Read once, trust over prose.

`CLAUDE.md` was removed; this file is the sole agent guide.

## Commands

```bash
pnpm install              # required first
pnpm dev:all              # frontend + backend concurrently (alias: pnpm start)
pnpm dev                  # Vite frontend only -> http://localhost:5173
pnpm dev:server           # Express backend only (tsx) -> http://localhost:3010
pnpm dev:ollama           # start local Ollama for ChatBot (port 11434)
pnpm desktop              # Electron shell: spawns server + Vite, loads :5173
pnpm desktop:prod         # vite build, then Electron loads backend-served bundle on :3010
pnpm build                # tsc -b && vite build  (typecheck is FRONTEND-ONLY — see below)
pnpm lint                 # eslint .  (no separate typecheck script)
pnpm lint:fix
pnpm format / format:check
```

No test framework, no CI. Verify frontend with `pnpm build`; lint catches the rest.

## Critical gotchas

- **Backend port is `3010`** (NOT 3001). Hardcoded in `server/index.ts:87`, `vite.config.ts` proxy, and `electron/main.cjs`. Frontend dev is `5173`, `vite preview` is `4173`.
- **Ollama URL is configurable via `OLLAMA_URL` env var** (default `http://localhost:11434`). Server loads `.env` automatically via `process.loadEnvFile()`. Used in two proxy routes (`server/index.ts`) and `scripts/start-ollama.sh`. `.env.example` documents the var.
- **`pnpm build` does NOT typecheck `server/`.** `tsconfig.node.json` only includes `vite.config.ts`; `tsconfig.app.json` only includes `src`. The backend runs via `tsx`, which strips types without checking — server type errors silently slip through. To catch them, run `pnpm exec tsc --noEmit -p tsconfig.node.json` after adding `server` to its `include`, or open the file in an editor. Don't assume a green build means correct backend types.
- **`erasableSyntaxOnly: true`** (both tsconfigs) → no `enum`, no `namespace`, no constructor parameter properties. Use `const` unions / plain objects instead.
- **`verbatimModuleSyntax: true`** → type-only imports MUST be `import type { ... }`. Mixing fails the build.
- **Backend imports use `.js` extensions on `.ts` source** (e.g. `from './services/systemMetrics.js'`). Mandatory for new backend modules (ESM + `moduleResolution: bundler`).
- **There is NO `tailwind.config.js`.** Tailwind 4 is configured in CSS: edit the `@theme {}` block and `@keyframes` in `src/index.css`. PostCSS loads `@tailwindcss/postcss`.
- **Runtime deps are split across `dependencies` and `devDependencies` inconsistently.** `express`, `ws`, `systeminformation`, `cors` live in **devDependencies** despite being required by the server → `pnpm install --prod` will NOT yield a runnable backend. `helmet`, `express-rate-limit`, `playwright`, `cheerio`, `zod` are correctly in `dependencies`. Don't "fix" this without checking intent.
- **Adding an external API/origin requires editing BOTH** the CSP `connectSrc`/`imgSrc` and the CORS `allowedOrigins` in `server/index.ts` (~lines 96–123). Current CSP `connectSrc` allows `wttr.in`; CORS allows origins `5173`/`4173`/`127.0.0.1:5173`. Browser silently blocks otherwise.
- **Path-traversal sandbox:** two validators in `server/index.ts` — `validatePath` (line 57, confines to `process.cwd()`) and `validateGitPath` (line 76, broader, used by all git endpoints). Any new endpoint taking a filesystem path MUST route through one of them.
- **Electron** (`electron/main.cjs`) spawns `tsx server/index.ts`, waits on `http://localhost:3010/health`, then loads `:5173` (dev) or `:3010` (prod, where the server serves the built bundle). `webPreferences: contextIsolation true, nodeIntegration false`.

## Architecture

- **Two-process app, no monorepo.** `pnpm-workspace.yaml` only allowlists the esbuild build — single package.
- Frontend (`src/`) is Vite + React 19. Vite proxies `/api` and `/ws` to `localhost:3010` (see `vite.config.ts`); in dev, components fetch `/api/...` relatively.
- Backend is a **single** `server/index.ts` (~900 lines, all routes inline) delegating to `server/services/*.ts` (one file per concern: systemMetrics, weather, docker, gitStatus, npmScripts, logAggregator, ufw, ports, portKiller, scraper). Each service exports plain functions.
- Realtime metrics stream over WebSocket `/ws` every 2s; REST endpoints cache 2–600s.
- `src/App.tsx` defines the `react-grid-layout` grid and mounts widgets from `src/components/`. Adding a widget = new component + mount it in `App.tsx`.

## Optional integrations (widgets degrade gracefully without these)

| Widget / endpoint                                        | Requires                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ChatBot                                                  | Ollama at `OLLAMA_URL` (default `localhost:11434`, `pnpm dev:ollama`)                           |
| WebScraper                                               | Playwright Chromium: `pnpm exec playwright install` (NixOS needs special handling, see README)  |
| DockerWidget                                             | Docker daemon socket access                                                                     |
| PortKiller                                               | `lsof` on PATH                                                                                  |
| PortScanner                                              | `nmap` or `ss` on PATH                                                                          |
| FirewallMonitor                                          | UFW (absent on NixOS — widget degrades)                                                         |
| GitWidget / NpmScriptRunner / LogAggregator                                  | shell out; confined via `validatePath`/`validateGitPath`                                         |

## Code conventions

- Functional React components, local `useState` only — no Redux/Context.
- Styling is Tailwind utility classes only (no CSS-in-JS); custom keyframes in `src/index.css`.
- TypeScript strict mode (+ `noUnusedLocals`/`noUnusedParameters`); types inline in component files, no shared `.d.ts`.
- Prettier (`.prettierrc`): single quotes, semis ON, trailing comma `es5`, `printWidth 100`, `arrowParens avoid`, `endOfLine lf`.
- ESLint flat config (`eslint.config.js`): `js` + `typescript-eslint` recommended + react-hooks + react-refresh; server files linted with **browser globals only** (no node globals, but `no-undef` is off for TS so `process` won't error).
- Editor: format-on-save + ESLint autofix via `.vscode/settings.json`.
