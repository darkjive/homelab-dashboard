import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { resolve } from 'path';

try {
  process.loadEnvFile();
} catch {
  // .env optional
}
import { getSystemMetrics } from './services/systemMetrics.js';
import { getWeather } from './services/weather.js';
import { scrapeUrl } from './services/scraper.js';
import { getActiveDevPorts, killPortProcess, getPortKillerStatus } from './services/portKiller.js';
import {
  getGitStatus,
  gitPull,
  gitPush,
  gitCommit,
  scanGitRepos,
  gitFetch,
  bulkPull,
  bulkPush,
  bulkCommit,
  bulkFetch,
} from './services/gitStatus.js';
import {
  getPackageScripts,
  runScript,
  getScriptOutput,
  stopScript,
  getRunningProcesses,
} from './services/npmScripts.js';
import {
  startTailing,
  stopTailing,
  stopAllTailing,
  getLogLines,
  getActiveTails,
  clearLogs,
  assignColor,
  getCommonLogSuggestions,
} from './services/logAggregator.js';
import { getDockerInfo } from './services/docker.js';
import { getUFWStatus, getUFWLogs, getTopAttackers } from './services/ufw.js';
import { getPortScan, getPortScannerStatus } from './services/ports.js';

// Sensitive system paths that must never be touched by git operations
const BLOCKED_PATH_PREFIXES = ['/proc', '/sys', '/dev', '/boot', '/etc', '/root', '/var/log'];

/**
 * Validate a path for git operations. Unlike validatePath, this allows
 * directories outside process.cwd() (needed because users configure their
 * own Dev roots), but still blocks traversal into sensitive system areas.
 */
function validateGitPath(userPath: string): string {
  const resolvedPath = resolve(userPath);
  for (const blocked of BLOCKED_PATH_PREFIXES) {
    if (resolvedPath === blocked || resolvedPath.startsWith(blocked + '/')) {
      throw new Error(`Access to path "${resolvedPath}" is blocked`);
    }
  }
  return resolvedPath;
}

/**
 * SSRF guard: returns true for hostnames that resolve to or are private /
 * loopback / link-local / CGNAT addresses. Prevents the scraper from being
 * used to probe internal services. Handles IPv4, IPv6 (incl. ::1, fc00::/7,
 * fe80::/10), and the literal "localhost" name.
 */
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '::' || host === '::ffff:127.0.0.1') return true;

  // IPv4 dotted-quad — strip any IPv4-in-IPv6 prefix
  const v4 = host.startsWith('::ffff:') ? host.slice(7) : host;
  const m = v4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])].map(octet => {
      if (octet > 255) return NaN;
      return octet;
    });
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  }

  // IPv6 private/link-local (only simple forms — does not normalize)
  if (host.startsWith('fc') || host.startsWith('fd')) return true; // fc00::/7 ULA
  if (host.startsWith('fe80:') || host.startsWith('fe90:') || host.startsWith('fea0:') || host.startsWith('feb0:'))
    return true; // fe80::/10 link-local

  return false;
}

const app = express();
const PORT = 3010;
// Bind to loopback by default. Set BIND_HOST=0.0.0.0 to expose on the LAN —
// make sure you understand the consequences (no auth on any endpoint).
const HOST = process.env.BIND_HOST || '127.0.0.1';
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const server = createServer(app);

// WebSocket server with proper configuration
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Allow connections from Vite dev server and production
  verifyClient: info => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://localhost:3010', // Allow direct connections too
    ];
    return !origin || allowedOrigins.some(allowed => origin?.startsWith(allowed));
  },
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'", 'http://localhost:3010', 'https://wttr.in'],
      },
    },
  })
);

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Disable rate limiting in development, use generous limits in production
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1000, // 1000 requests per minute
  skip: req => {
    // Skip rate limiting for localhost in development
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('localhost');
    return isLocalhost || process.env.NODE_ENV === 'development';
  },
  message: { error: 'Too many requests, please try again later' },
});

const scraperLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Scraping rate limit exceeded' },
});

const ollamaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Ollama rate limit exceeded' },
});

app.get('/api/metrics', generalLimiter, async (req, res) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Failed to fetch system metrics:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

app.get('/api/weather', async (req, res) => {
  try {
    const locationSchema = z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9\s,.-]+$/);
    const location = locationSchema.parse((req.query.location as string) || 'Munich');

    const weather = await getWeather(location);
    res.json(weather);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid location format' });
    }
    console.error('Failed to fetch weather:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

app.get('/api/docker', generalLimiter, async (req, res) => {
  try {
    const dockerInfo = await getDockerInfo();
    res.json(dockerInfo);
  } catch (error) {
    console.error('Failed to fetch Docker info:', error);
    res.status(500).json({ error: 'Failed to fetch Docker info' });
  }
});

// Firewall monitoring endpoints
app.get('/api/firewall/status', generalLimiter, async (req, res) => {
  try {
    const status = await getUFWStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to fetch UFW status:', error);
    res.status(500).json({ error: 'Failed to fetch UFW status' });
  }
});

app.get('/api/firewall/logs', generalLimiter, async (req, res) => {
  try {
    const limitSchema = z.number().int().min(1).max(1000).optional();
    const limit = limitSchema.parse(req.query.limit ? Number(req.query.limit) : 100);
    const logs = await getUFWLogs(limit);
    res.json({ logs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    console.error('Failed to fetch UFW logs:', error);
    res.status(500).json({ error: 'Failed to fetch UFW logs' });
  }
});

app.get('/api/firewall/top-attackers', generalLimiter, async (req, res) => {
  try {
    const limitSchema = z.number().int().min(1).max(50).optional();
    const limit = limitSchema.parse(req.query.limit ? Number(req.query.limit) : 10);
    const attackers = await getTopAttackers(limit);
    res.json({ attackers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    console.error('Failed to fetch top attackers:', error);
    res.status(500).json({ error: 'Failed to fetch top attackers' });
  }
});

app.get('/api/firewall/ports', generalLimiter, async (req, res) => {
  try {
    const [portScan, status] = await Promise.all([getPortScan(), getPortScannerStatus()]);
    res.json({ ...portScan, tools: status });
  } catch (error) {
    console.error('Failed to perform port scan:', error);
    res.status(500).json({ error: 'Failed to perform port scan' });
  }
});

app.post('/api/scrape', scraperLimiter, async (req, res) => {
  try {
    const scrapeSchema = z.object({
      url: z.string().url().max(2048),
      depth: z.number().int().min(1).max(3),
      maxPages: z.number().int().min(1).max(50).optional(),
    });

    const { url, depth, maxPages } = scrapeSchema.parse(req.body);
    const urlObj = new URL(url);
    if (isPrivateOrLoopbackHost(urlObj.hostname)) {
      return res.status(403).json({ error: 'Cannot scrape internal/private networks' });
    }

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(403).json({ error: 'Only HTTP/HTTPS protocols allowed' });
    }

    console.log(`[SCRAPER] Starting scrape: ${url} (depth: ${depth}, maxPages: ${maxPages || 50})`);

    const result = await scrapeUrl({ url, depth, maxPages });

    console.log(`[SCRAPER] Completed: ${result.metadata.pagesScraped} pages scraped`);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }
    console.error('[SCRAPER] Failed to scrape:', error);
    res.status(500).json({
      error: 'Failed to scrape URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET endpoint for Ollama (health checks, listing models)
app.get('/api/ollama/api/:endpoint', ollamaLimiter, async (req, res) => {
  try {
    const ollamaPath = `/api/${req.params.endpoint}`;
    const ollamaUrl = `${OLLAMA_BASE_URL}${ollamaPath}`;

    const response = await fetch(ollamaUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      // Silent fail for health checks - don't spam logs
      return res.status(503).json({
        available: false,
        error: 'Ollama service not available',
      });
    }

    const data = await response.json();
    res.json(data);
  } catch {
    // Silent fail - Ollama not running is expected
    res.status(503).json({
      available: false,
      error: 'Ollama service not running',
    });
  }
});

// POST endpoint for Ollama (chat, generate)
app.post('/api/ollama/api/:endpoint', ollamaLimiter, async (req, res) => {
  try {
    const ollamaPath = `/api/${req.params.endpoint}`;
    const ollamaUrl = `${OLLAMA_BASE_URL}${ollamaPath}`;

    console.log(`[OLLAMA PROXY] ${req.method} ${ollamaPath}`);

    const response = await fetch(ollamaUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      console.error(`[OLLAMA PROXY] Error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Ollama error: ${response.statusText}`,
        details: 'Make sure Ollama is running (ollama serve)',
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[OLLAMA PROXY] Failed:', error);
    res.status(503).json({
      error: 'Ollama service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Run: ollama serve',
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Fetches real service status from Statuspage.io APIs
app.get('/api/service-status', generalLimiter, async (req, res) => {
  const services = [
    {
      name: 'Cloudflare',
      apiUrl: 'https://www.cloudflarestatus.com/api/v2/status.json',
      statusUrl: 'https://www.cloudflarestatus.com/',
    },
    {
      name: 'GitHub',
      apiUrl: 'https://www.githubstatus.com/api/v2/status.json',
      statusUrl: 'https://www.githubstatus.com/',
    },
    {
      name: 'OpenAI',
      apiUrl: 'https://status.openai.com/api/v2/status.json',
      statusUrl: 'https://status.openai.com/',
    },
    {
      name: 'Anthropic',
      apiUrl: 'https://status.anthropic.com/api/v2/status.json',
      statusUrl: 'https://status.anthropic.com/',
    },
    {
      name: 'Vercel',
      apiUrl: 'https://www.vercel-status.com/api/v2/status.json',
      statusUrl: 'https://www.vercel-status.com/',
    },
  ];

  const results = await Promise.allSettled(
    services.map(async service => {
      const response = await fetch(service.apiUrl, { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      const indicator: string = data?.status?.indicator ?? 'unknown';
      const status =
        indicator === 'none'
          ? 'operational'
          : indicator === 'minor'
            ? 'degraded'
            : indicator === 'major' || indicator === 'critical'
              ? 'outage'
              : 'unknown';
      return {
        name: service.name,
        status,
        description: data?.status?.description ?? '',
        statusUrl: service.statusUrl,
      };
    })
  );

  const statuses = results.map((result, i) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          name: services[i].name,
          status: 'unknown',
          description: 'Unable to fetch',
          statusUrl: services[i].statusUrl,
        }
  );

  res.json({ services: statuses, timestamp: Date.now() });
});

// HTTP HEAD connectivity checks with latency to key internet endpoints
app.get('/api/connectivity', generalLimiter, async (req, res) => {
  const targets = [
    { name: 'Cloudflare DNS', url: 'https://1.1.1.1' },
    { name: 'Google DNS', url: 'https://8.8.8.8' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Cloudflare', url: 'https://cloudflare.com' },
    { name: 'Google', url: 'https://google.com' },
  ];

  const results = await Promise.allSettled(
    targets.map(async target => {
      const start = Date.now();
      await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return { name: target.name, reachable: true, latencyMs: Date.now() - start };
    })
  );

  const checks = results.map((result, i) =>
    result.status === 'fulfilled'
      ? result.value
      : { name: targets[i].name, reachable: false, latencyMs: null }
  );

  res.json({ checks, timestamp: Date.now() });
});

app.get('/api/ports', generalLimiter, async (req, res) => {
  try {
    const [ports, status] = await Promise.all([getActiveDevPorts(), getPortKillerStatus()]);
    res.json({ ports, tools: status });
  } catch (error) {
    console.error('Failed to fetch active ports:', error);
    res.status(500).json({ error: 'Failed to fetch active ports' });
  }
});

app.post('/api/ports/kill', generalLimiter, async (req, res) => {
  try {
    const portSchema = z.object({
      port: z.number().int().min(1).max(65535),
    });

    const { port } = portSchema.parse(req.body);
    const result = await killPortProcess(port);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid port number' });
    }
    console.error('Failed to kill port process:', error);
    res.status(500).json({ error: 'Failed to kill process' });
  }
});

app.get('/api/git/status', generalLimiter, async (req, res) => {
  try {
    const userPath = (req.query.path as string) || process.cwd();
    const repoPath = validateGitPath(userPath);
    const status = await getGitStatus(repoPath);
    res.json(status);
  } catch (error) {
    console.error('Failed to get git status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get git status';
    res.status(500).json({ error: message });
  }
});

app.post('/api/git/pull', generalLimiter, async (req, res) => {
  try {
    const userPath = (req.query.path as string) || process.cwd();
    const repoPath = validateGitPath(userPath);
    const result = await gitPull(repoPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to pull:', error);
    res.status(500).json({ error: 'Failed to pull' });
  }
});

app.post('/api/git/push', generalLimiter, async (req, res) => {
  try {
    const userPath = (req.query.path as string) || process.cwd();
    const repoPath = validateGitPath(userPath);
    const result = await gitPush(repoPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to push:', error);
    res.status(500).json({ error: 'Failed to push' });
  }
});

app.post('/api/git/fetch', generalLimiter, async (req, res) => {
  try {
    const userPath = (req.query.path as string) || process.cwd();
    const repoPath = validateGitPath(userPath);
    const result = await gitFetch(repoPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to fetch:', error);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

app.post('/api/git/commit', generalLimiter, async (req, res) => {
  try {
    const commitSchema = z.object({
      message: z.string().min(1).max(500),
    });

    const { message } = commitSchema.parse(req.body);
    const userPath = (req.query.path as string) || process.cwd();
    const repoPath = validateGitPath(userPath);
    const result = await gitCommit(message, repoPath);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid commit message' });
    }
    console.error('Failed to commit:', error);
    res.status(500).json({ error: 'Failed to commit' });
  }
});

// ============================================================
// Multi-repo overview endpoints
// ============================================================

const rootsSchema = z.object({
  roots: z.array(z.string().min(1)).min(1).max(20),
  maxDepth: z.number().int().min(1).max(8).optional(),
});

app.post('/api/git/scan', generalLimiter, async (req, res) => {
  try {
    const { roots: rawRoots, maxDepth } = rootsSchema.parse(req.body);
    const roots = rawRoots.map(validateGitPath);
    const summaries = await scanGitRepos(roots, maxDepth ?? 3);
    res.json({ repos: summaries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid roots' });
    }
    console.error('Failed to scan git repos:', error);
    const message = error instanceof Error ? error.message : 'Failed to scan';
    res.status(500).json({ error: message });
  }
});

const bulkPathsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(200),
});

app.post('/api/git/bulk/pull', generalLimiter, async (req, res) => {
  try {
    const { paths: rawPaths } = bulkPathsSchema.parse(req.body);
    const paths = rawPaths.map(validateGitPath);
    const results = await bulkPull(paths);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid paths' });
    }
    console.error('Failed bulk pull:', error);
    res.status(500).json({ error: 'Failed bulk pull' });
  }
});

app.post('/api/git/bulk/push', generalLimiter, async (req, res) => {
  try {
    const { paths: rawPaths } = bulkPathsSchema.parse(req.body);
    const paths = rawPaths.map(validateGitPath);
    const results = await bulkPush(paths);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid paths' });
    }
    console.error('Failed bulk push:', error);
    res.status(500).json({ error: 'Failed bulk push' });
  }
});

app.post('/api/git/bulk/fetch', generalLimiter, async (req, res) => {
  try {
    const { paths: rawPaths } = bulkPathsSchema.parse(req.body);
    const paths = rawPaths.map(validateGitPath);
    const results = await bulkFetch(paths);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid paths' });
    }
    console.error('Failed bulk fetch:', error);
    res.status(500).json({ error: 'Failed bulk fetch' });
  }
});

const bulkCommitSchema = z.object({
  items: z
    .array(
      z.object({
        path: z.string().min(1),
        message: z.string().min(1).max(500),
      })
    )
    .min(1)
    .max(200),
});

app.post('/api/git/bulk/commit', generalLimiter, async (req, res) => {
  try {
    const { items: rawItems } = bulkCommitSchema.parse(req.body);
    const items = rawItems.map(it => ({ path: validateGitPath(it.path), message: it.message }));
    const results = await bulkCommit(items);
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid items' });
    }
    console.error('Failed bulk commit:', error);
    res.status(500).json({ error: 'Failed bulk commit' });
  }
});

app.get('/api/npm/scripts', generalLimiter, async (req, res) => {
  try {
    const repoPath = (req.query.path as string) || process.cwd();
    const scripts = await getPackageScripts(repoPath);
    res.json(scripts);
  } catch (error) {
    console.error('Failed to get package scripts:', error);
    res.status(500).json({ error: 'Failed to read package.json' });
  }
});

app.post('/api/npm/run', generalLimiter, async (req, res) => {
  try {
    const runSchema = z.object({
      scriptName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/, 'Invalid script name'),
      repoPath: z.string().optional(),
      packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).optional(),
    });

    const { scriptName, repoPath, packageManager } = runSchema.parse(req.body);
    const processId = runScript(scriptName, repoPath || process.cwd(), packageManager || 'npm');

    res.json({ processId, message: 'Script started' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Failed to run script:', error);
    res.status(500).json({ error: 'Failed to run script' });
  }
});

app.get('/api/npm/output/:processId', generalLimiter, async (req, res) => {
  try {
    const processId = req.params.processId;
    const output = getScriptOutput(processId);
    res.json(output);
  } catch (error) {
    console.error('Failed to get script output:', error);
    res.status(500).json({ error: 'Failed to get output' });
  }
});

app.post('/api/npm/stop', generalLimiter, async (req, res) => {
  try {
    const stopSchema = z.object({
      processId: z.string().min(1),
    });

    const { processId } = stopSchema.parse(req.body);
    const result = stopScript(processId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Failed to stop script:', error);
    res.status(500).json({ error: 'Failed to stop script' });
  }
});

app.get('/api/npm/running', generalLimiter, async (req, res) => {
  try {
    const processes = getRunningProcesses();
    res.json({ processes });
  } catch (error) {
    console.error('Failed to get running processes:', error);
    res.status(500).json({ error: 'Failed to get running processes' });
  }
});

app.post('/api/logs/tail', generalLimiter, async (req, res) => {
  try {
    const tailSchema = z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(100),
      path: z.string().min(1).max(500),
      color: z.string().optional(),
    });

    const file = tailSchema.parse(req.body);
    if (!file.color) {
      file.color = assignColor();
    }

    const result = await startTailing(file);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Failed to start tailing:', error);
    res.status(500).json({ error: 'Failed to start tailing' });
  }
});

app.post('/api/logs/stop', generalLimiter, async (req, res) => {
  try {
    const stopSchema = z.object({
      fileId: z.string().min(1),
    });

    const { fileId } = stopSchema.parse(req.body);
    const result = stopTailing(fileId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Failed to stop tailing:', error);
    res.status(500).json({ error: 'Failed to stop tailing' });
  }
});

app.get('/api/logs/lines', generalLimiter, async (req, res) => {
  try {
    const fileIds = req.query.fileIds ? (req.query.fileIds as string).split(',') : undefined;
    const lines = getLogLines(fileIds);
    res.json({ lines });
  } catch (error) {
    console.error('Failed to get log lines:', error);
    res.status(500).json({ error: 'Failed to get log lines' });
  }
});

app.get('/api/logs/active', generalLimiter, async (req, res) => {
  try {
    const tails = getActiveTails();
    res.json({ tails });
  } catch (error) {
    console.error('Failed to get active tails:', error);
    res.status(500).json({ error: 'Failed to get active tails' });
  }
});

app.post('/api/logs/clear', generalLimiter, async (req, res) => {
  try {
    const fileId = req.body.fileId as string | undefined;
    clearLogs(fileId);
    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

app.get('/api/logs/common-paths', generalLimiter, async (req, res) => {
  try {
    const repoPath = (req.query.path as string) || process.cwd();
    const suggestions = getCommonLogSuggestions(repoPath);
    res.json({ suggestions });
  } catch (error) {
    console.error('Failed to get common paths:', error);
    res.status(500).json({ error: 'Failed to get common paths' });
  }
});

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] Client connected from:', req.socket.remoteAddress);

  const sendMetrics = async () => {
    try {
      const metrics = await getSystemMetrics();
      if (ws.readyState === 1) {
        // OPEN
        ws.send(JSON.stringify(metrics));
      }
    } catch (error) {
      console.error('[WebSocket] Failed to send metrics:', error);
    }
  };

  // Send initial metrics immediately
  sendMetrics();
  const intervalId = setInterval(sendMetrics, 2000);

  // Send ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 30000);

  // Cleanup function to clear all intervals
  const cleanup = () => {
    console.log('[WebSocket] Client disconnected, cleaning up');
    clearInterval(intervalId);
    clearInterval(pingInterval);
  };

  ws.on('close', cleanup);

  ws.on('error', error => {
    console.error('[WebSocket] Connection error:', error);
    cleanup();
  });
});

wss.on('error', error => {
  console.error('[WebSocket Server] Error:', error);
});

// Serve built frontend (single-origin prod / Electron desktop mode).
// Registered after all API routes so they take precedence; no SPA fallback needed
// (no client-side router) — express.static serves index.html for "/" automatically.
const distDir = resolve(process.cwd(), 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Homelab Dashboard API running on http://${HOST}:${PORT}`);
  console.log(`📊 System Metrics (HTTP): http://${HOST}:${PORT}/api/metrics`);
  console.log(`📊 System Metrics (WebSocket): ws://${HOST}:${PORT}/ws`);
  console.log(`🌤️  Weather: http://${HOST}:${PORT}/api/weather?location=Munich`);
  console.log(`🤖 Ollama Proxy: POST http://${HOST}:${PORT}/api/ollama/*`);
  console.log(`🌐 Web Scraper: POST http://${HOST}:${PORT}/api/scrape`);
  console.log(`✅ Health Check: http://${HOST}:${PORT}/health`);
  if (HOST === '127.0.0.1' || HOST === '::1') {
    console.log(`\n🔒 Listening on loopback only. Set BIND_HOST=0.0.0.0 to expose on LAN.\n`);
  } else {
    console.log(`\n⚠️  WARNING: listening on ${HOST} — endpoints have NO AUTH. Anyone reachable can run git push, kill processes, run npm scripts, etc.\n`);
  }
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, cleaning up...');
  stopAllTailing();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, cleaning up...');
  stopAllTailing();
  process.exit(0);
});
