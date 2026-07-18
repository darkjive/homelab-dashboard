# 🚀 Homelab Control Center

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

> **Futuristic homelab dashboard with real-time system monitoring and cyberpunk aesthetics inspired by pxlngn.net**

## ✨ Features

### Widgets (real backend data)

| Widget                                    | Data Source                                          |
| ----------------------------------------- | ---------------------------------------------------- |
| **System Metrics** (CPU, RAM, Disk, Temp) | `systeminformation` library                          |
| **Weather**                               | wttr.in API                                          |
| **Docker Monitoring**                     | Docker socket                                        |
| **ChatBot**                               | Local [Ollama](https://ollama.ai) (auto-discovers)   |
| **Git Widget**                            | status, pull, push, fetch, commit, bulk operations   |
| **NPM Script Runner**                     | runs scripts from `package.json`                     |
| **Log Aggregator**                        | tail system/app logs                                 |
| **Web Scraper**                           | Playwright/Chromium (see NixOS note below)           |
| **Port Killer**                           | requires `lsof`                                      |
| **Firewall Monitor**                      | requires UFW (not available on NixOS)                |
| **Port Scanner**                          | requires `nmap`/`ss`                                 |
| **GitHub Stats**                          | GitHub API                                           |
| **Hacker News Feed**                      | HN Algolia API                                       |
| **RSS Feed** / **Custom RSS Feed**        | any RSS/Atom URL                                     |
| **Service Status**                        | Statuspage.io API (Cloudflare, GitHub, OpenAI, etc.) |
| **Connectivity Monitor**                  | HTTP latency checks to internet endpoints            |
| **Network Outage Map**                    | visualizes connectivity status                       |

### Local-only widgets (no backend)

| Widget                | Storage               |
| --------------------- | --------------------- |
| **Markdown Editor**   | `localStorage`        |
| **Quick Links**       | `localStorage`        |
| **Sound Manager**     | browser Web Audio API |

### 🎨 Cyberpunk Design

- **Cyan/Orange Gradient Palette** (pxlngn.net inspired)
- **Animated Scan Line Effect** (retro terminal vibe)
- **Glowing Text Effects** (cyberpunk aesthetics)
- **Responsive Grid Layout** (mobile-first design)
- **Custom Scrollbars** (themed for immersion)
- **Blinking Cursor Animation** ("INITIALIZING..." effect)

## 🛠️ Tech Stack

### Frontend

- **React 19.2** - Latest React with Concurrent Features
- **Vite 7.2** - Lightning-fast build tool
- **TypeScript 5.9** - Type safety
- **Tailwind CSS 4.1** - Utility-first styling (configured in `src/index.css`)
- **Recharts 3.5** - Data visualization
- **Lucide React** - Icon library
- **react-grid-layout** - Draggable/resizable widget grid

### Backend

- **Express 5.2** - Node.js API server
- **systeminformation** - Cross-platform system metrics
- **WebSockets (ws)** - Real-time data streaming (every 2s)
- **Docker API** - Container status monitoring
- **Playwright** - Headless Chromium for web scraping
- **Helmet + CORS + express-rate-limit** - Security layers

## 🚀 Quick Start

### Prerequisites

- **Node.js 22+**
- **pnpm**
- Optional: **Docker**, **Ollama**, **UFW**, **lsof**, **nmap** (per-widget)

### Installation

```bash
git clone <repo-url> homelab-dashboard
cd homelab-dashboard
pnpm install

# Start frontend (http://localhost:5173) + backend (http://localhost:3010)
pnpm dev:all

# Or start separately:
pnpm dev        # Frontend only (Vite) - http://localhost:5173
pnpm dev:server # Backend only (Express) - http://localhost:3010
pnpm dev:ollama # Local Ollama server (optional, for ChatBot) - http://localhost:11434
```

### Configuration

The dashboard works out of the box with defaults. For overrides, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable     | Default                   | Purpose                                                    |
| ------------ | ------------------------- | ---------------------------------------------------------- |
| `OLLAMA_URL` | `http://localhost:11434`  | Ollama server URL (chatbot proxy)                          |
| `BIND_HOST`  | `127.0.0.1`               | Network interface to bind the backend to (loopback default) |

> Backend port is hardcoded to `3010`. Frontend dev is `5173`, Vite preview is `4173`.

### ⚠️ Security defaults

The backend **binds to loopback (`127.0.0.1`) by default** — only your local browser can reach it. This is intentional: there is **no authentication** on any endpoint, and several can run shell commands on your behalf (`/api/ports/kill`, `/api/npm/run`, `/api/git/push|commit`, `/api/logs/tail`, `/api/scrape`).

If you really need LAN access, opt in explicitly:

```bash
BIND_HOST=0.0.0.0 pnpm dev:server   # exposes backend to the network — your responsibility
```

### Optional system tools

Widgets degrade gracefully if a tool is missing, and report the reason in their JSON response.

| Tool                | Required by                          | Install hint                                |
| ------------------- | ------------------------------------ | ------------------------------------------- |
| `lsof`              | PortKiller                           | Debian: `lsof`, NixOS: `pkgs.lsof`          |
| `nmap` (optional)   | PortScanner external scan            | Debian: `nmap`                              |
| `ss`                | PortScanner local listeners          | ships with `iproute2`                       |
| `ufw` + sudo        | FirewallMonitor (Ubuntu/Debian only) | needs passwordless sudo for `ufw` + `/var/log/kern.log` |
| `ollama`            | ChatBot                              | https://ollama.ai                           |
| Docker daemon       | DockerWidget                         | user in `docker` group                      |
| Playwright Chromium | WebScraper                           | `pnpm exec playwright install`              |

### Installation caveat: `pnpm install --prod` does NOT yield a runnable backend

Several runtime backend deps (`express`, `ws`, `systeminformation`, `cors`) currently live in `devDependencies`. Always install with the full `pnpm install`, never `--prod`.

### Customization

#### Change Weather Location

Edit `src/App.tsx`:

```tsx
<WeatherWidget location="Berlin" />  // Change to your city
```

#### Modify Color Theme

Tailwind 4 is configured via CSS. Edit the `@theme {}` block in `src/index.css`:

```css
@theme {
  --color-cyber-cyan: rgb(0, 195, 255);
  --color-cyber-orange: rgb(255, 135, 0);
  --color-cyber-darkbg: #0a0e27;
  --color-cyber-cardbg: #151a2e;
}
```

## 📁 Project Structure

```
homelab-dashboard/
├── server/
│   ├── index.ts                  # Express API (all routes inline)
│   └── services/                 # One file per concern
│       ├── systemMetrics.ts
│       ├── weather.ts
│       ├── docker.ts
│       ├── gitStatus.ts
│       ├── npmScripts.ts
│       ├── logAggregator.ts
│       ├── scraper.ts
│       ├── ufw.ts
│       ├── ports.ts
│       └── portKiller.ts
├── src/
│   ├── components/               # One file per widget
│   ├── App.tsx                   # Main dashboard grid layout
│   ├── index.css                 # Tailwind + cyberpunk theme
│   └── main.tsx                  # React entry point
├── electron/
│   └── main.cjs                  # Electron shell (spawns server + vite)
├── scripts/
│   └── start-ollama.sh
├── .env.example
├── eslint.config.js              # ESLint flat config
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Backend (`http://localhost:3010`)

| Endpoint                           | Description                              |
| ---------------------------------- | ---------------------------------------- |
| `GET /api/metrics`                 | System metrics (CPU, RAM, Disk, Network) |
| `GET /api/weather?location=...`    | Weather from wttr.in                     |
| `GET /api/docker`                  | Docker container status                  |
| `GET /api/firewall/*`              | UFW status, logs, ports, top-attackers   |
| `GET /api/service-status`          | Aggregated Statuspage.io data            |
| `GET /api/connectivity`            | HTTP latency probes                      |
| `GET /api/ports`                   | Active listening ports                   |
| `POST /api/ports/kill`             | Kill process by port                     |
| `GET/POST /api/git/*`              | status, pull, push, fetch, commit, bulk  |
| `GET/POST /api/npm/*`              | scripts, run, output, stop, running      |
| `POST /api/logs/*`                 | tail, stop, lines, active, clear         |
| `POST /api/scrape`                 | Playwright scraper                       |
| `GET/POST /api/ollama/api/:name`   | Proxy to Ollama                          |
| `GET /health`                      | Health check                             |
| `WebSocket /ws`                    | Real-time metrics stream (2s interval)   |

All endpoints cached 2–600s server-side; rate-limited per concern.

## 🧩 Optional Integrations

Widgets degrade gracefully if the underlying tool is missing.

| Widget         | Requires                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| ChatBot        | [Ollama](https://ollama.ai) at `OLLAMA_URL` (default `localhost:11434`)                          |
| WebScraper     | `pnpm exec playwright install` (NixOS: see below)                                                |
| DockerWidget   | Docker daemon socket access                                                                      |
| PortKiller     | `lsof` on PATH                                                                                   |
| PortScanner    | `nmap` or `ss` on PATH                                                                           |
| FirewallMonitor| UFW (absent on NixOS — widget degrades)                                                          |
| Git/NPM/Logs   | shell out; paths validated against `process.cwd()` to prevent traversal                          |

### NixOS Note (Playwright)

NixOS doesn't ship standard glibc paths Playwright expects. Use [`playwright-nix`](https://github.com/nginx-nixos/playwright-nix) or run Chromium via a FHS env. See [NixOS wiki: Playwright](https://nixos.wiki/wiki/Playwright).

## 🎯 Use Cases

- **Personal homelab dashboard** – Monitor home server, Docker containers, services from one interface.
- **Developer control center** – Watch resources while running multiple dev environments.
- **System administration** – Quick overview of system health, ports, firewall, services.

## 🔧 Development

```bash
pnpm build      # tsc -b + vite build (frontend typecheck only)
pnpm preview    # Preview production build (port 4173)
pnpm lint       # ESLint
pnpm format     # Prettier
pnpm desktop    # Electron dev (spawns server + vite)
pnpm desktop:prod  # vite build, then Electron loads backend bundle on :3010
```

> `pnpm build` typechecks `src/` only. The backend (`server/`) runs via `tsx` which strips types without checking — backend type errors won't fail the build.

## 🎨 Design Inspiration

Heavily inspired by **[pxlngn.net](https://pxlngn.net)**:

- Cyan/Orange gradient palette (`rgb(0, 195, 255)` + `rgb(255, 135, 0)`)
- JetBrains Mono typography
- Blinking cursor animation ("INITIALIZING..." effect)
- Scan line effect (retro terminal aesthetic)
- Glowing text shadows (cyberpunk neon)

## 📄 License

MIT License.

## 🙏 Acknowledgments

- **[Homepage by gethomepage](https://github.com/gethomepage/homepage)** - Dashboard structure inspiration
- **[pxlngn.net](https://pxlngn.net)** - Design aesthetics and color palette
- **[wttr.in](https://wttr.in)** - Weather data API
- **[systeminformation](https://github.com/sebhildebrandt/systeminformation)** - System metrics library

---

<p align="center">
  Built with <span style="color: rgb(0, 195, 255)">Cyan</span> and <span style="color: rgb(255, 135, 0)">Orange</span> 🚀
</p>
