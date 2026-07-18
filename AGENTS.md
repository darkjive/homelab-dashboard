# AGENTS.md

High-signal notes for agent sessions (OpenCode, Claude Code, …). Read once, trust over prose.

`CLAUDE.md` was removed; this file is the sole agent guide.

## Commands

```bash
pnpm install              # required first (electron+esbuild builds are allowlisted in pnpm-workspace.yaml)
pnpm dev:all              # frontend + backend concurrently (alias: pnpm start)
pnpm dev                  # Vite frontend only -> http://localhost:5173
pnpm dev:server           # Express backend only (tsx) -> http://localhost:3010
pnpm dev:ollama           # start local Ollama for ChatBot (port 11434)
pnpm desktop              # Electron shell: spawns server + Vite, loads :5173
pnpm desktop:prod         # vite build, then Electron loads backend-served bundle on :3010
pnpm build                # tsc -b && typecheck:server && vite build (BOTH sides typechecked)
pnpm typecheck:server     # backend-only typecheck (tsconfig.server.json)
pnpm lint                 # eslint .
pnpm lint:fix
pnpm format / format:check
```

No test framework, no CI. Verify with `pnpm build` (typechecks frontend AND backend) + `pnpm lint`.

## Critical gotchas

- **Backend port defaults to `3010`**, overridable via `PORT` env var — read by `server/index.ts`, `vite.config.ts` (proxy target) and `electron/main.cjs`. Frontend dev is `5173`, `vite preview` is `4173`.
- **Frontend calls the API with RELATIVE paths only** (`/api/...`, WebSocket URL derived from `window.location`). Never hardcode `localhost:3010` in a component — it breaks LAN access (`BIND_HOST`) and Electron prod.
- **Shared wire types live in `shared/types.ts`** — imported by both `server/` (with `.js` extension) and `src/` (without). Types containing `Date` fields (UFW logs, port-scan results) intentionally stay local per side, since JSON serializes Dates to strings.
- **Ollama URL is configurable via `OLLAMA_URL` env var** (default `http://localhost:11434`). Server loads `.env` automatically via `process.loadEnvFile()`. The proxy only forwards whitelisted endpoints (`OLLAMA_GET_ENDPOINTS`/`OLLAMA_POST_ENDPOINTS` in `server/index.ts`).
- **`erasableSyntaxOnly: true`** (all tsconfigs) → no `enum`, no `namespace`, no constructor parameter properties. Use `const` unions / plain objects instead.
- **`verbatimModuleSyntax: true`** → type-only imports MUST be `import type { ... }`. Mixing fails the build.
- **Backend imports use `.js` extensions on `.ts` source** (e.g. `from './services/systemMetrics.js'`). Mandatory for new backend modules (ESM + `moduleResolution: bundler`).
- **There is NO `tailwind.config.js`.** Tailwind 4 is configured in CSS: edit the `@theme {}` block and `@keyframes` in `src/index.css`. PostCSS loads `@tailwindcss/postcss`.
- **Adding an external API the BROWSER calls directly requires editing the CSP `connectSrc`** in `server/index.ts` — it applies to the served bundle (Electron prod / single-origin mode); a missing entry is silently blocked there while dev mode works. Backend-proxied APIs (weather) don't need CSP entries.
- **Path guards in `server/index.ts` + services:** `validateGitPath` (git/npm/log-suggestion endpoints; blocks `/etc`, `/proc`, `/root`, … prefixes) and `assertTailablePath` in `logAggregator.ts` (tailing limited to cwd, `/var/log`, `$HOME` minus credential dirs). Any new endpoint taking a filesystem path MUST route through one of them. The Host-header allowlist middleware (DNS-rebinding guard) applies to all routes on loopback binds.
- **Settings pattern:** widget config is persisted via `useSetting`/`useSettingJSON` from `src/lib/settings.ts` (localStorage + `homelab:settings-changed` event sync with the SettingsPanel). Don't hand-roll `localStorage.getItem` + event listeners in components. Error feedback uses `toast()` from `src/lib/toast.ts` (+ `<Toaster />` mounted in App), not `alert()`.
- **Electron** (`electron/main.cjs`) spawns `tsx server/index.ts`, waits on `/health`, then loads `:5173` (dev) or `:3010` (prod). `webPreferences: contextIsolation true, nodeIntegration false`. Its binary download needs the `onlyBuiltDependencies` allowlist in `pnpm-workspace.yaml` (fallback: `pnpm approve-builds`).

## Architecture

- **Two-process app, no monorepo.** Single package; `pnpm-workspace.yaml` only holds the build-script allowlist.
- Frontend (`src/`) is Vite + React 19. Vite proxies `/api` and `/ws` to the backend (see `vite.config.ts`); components always fetch relatively.
- Backend is a **single** `server/index.ts` (all routes inline) delegating to `server/services/*.ts` (one file per concern: systemMetrics, weather, docker, gitStatus, npmScripts, logAggregator, netGuard, ufw, ports, portKiller, scraper). Each service exports plain functions.
- Realtime metrics: ONE shared 2s broadcast loop over WebSocket `/ws` (not per-client intervals); `getSystemMetrics()` has a 2s cache, Docker 5s.
- `src/App.tsx` defines the `react-grid-layout` grid and mounts widgets from `src/components/`. Adding a widget = new component + mount it in `App.tsx`.

## Optional integrations (widgets degrade gracefully without these)

| Widget / endpoint | Requires                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| ChatBot           | Ollama at `OLLAMA_URL` (default `localhost:11434`, `pnpm dev:ollama`)                           |
| WebScraper        | Playwright Chromium: `pnpm exec playwright install` (NixOS needs special handling, see README)  |
| DockerWidget      | Docker daemon socket access                                                                     |
| PortKiller        | `lsof` on PATH                                                                                  |
| PortScanner       | `nmap` or `ss` on PATH                                                                          |
| FirewallMonitor   | UFW + passwordless sudo (`sudo -n`; absent on NixOS — widget degrades)                          |
| Git/NPM/Logs      | shell out; confined via `validateGitPath` / `assertTailablePath`                                |
| SoundManager      | audio file at `public/audio/ambiance-legal.ogg` (gitignored; widget disables itself without it) |

## Code conventions

- Functional React components, local `useState` + the settings hooks — no Redux/Context.
- Styling is Tailwind utility classes only (no CSS-in-JS); custom keyframes in `src/index.css`.
- TypeScript strict mode (+ `noUnusedLocals`/`noUnusedParameters`) on BOTH sides; shared wire types in `shared/types.ts`, widget-local UI types inline.
- Prettier (`.prettierrc`): single quotes, semis ON, trailing comma `es5`, `printWidth 100`, `arrowParens avoid`, `endOfLine lf`.
- ESLint flat config (`eslint.config.js`): `src/` + `shared/` with browser globals + react-hooks/react-refresh; `server/` + `vite.config.ts` with node globals, no React rules.
- Editor: format-on-save + ESLint autofix via `.vscode/settings.json`.
