import { spawn, ChildProcess } from 'child_process';
import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { LogFile, LogLine, LogLevel, LogSuggestion } from '../../shared/types.js';

interface TailProcess {
  process: ChildProcess;
  buffer: LogLine[];
  file: LogFile;
}

const tailProcesses = new Map<string, TailProcess>();
const colors = [
  '#00c3ff', // cyan
  '#ff8700', // orange
  '#00ff87', // green
  '#ff00ff', // magenta
  '#ffff00', // yellow
  '#00ffff', // cyan bright
  '#ff0087', // pink
];

let colorIndex = 0;

export function detectLogLevel(line: string): LogLevel {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('ERR') || upper.includes('FATAL')) return 'ERROR';
  if (upper.includes('WARN') || upper.includes('WARNING')) return 'WARN';
  if (upper.includes('INFO')) return 'INFO';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'UNKNOWN';
}

// Tailing is allowed under these roots. This must stay in sync with what
// getCommonLogSuggestions offers — suggesting a path the tailer rejects is a bug.
const ALLOWED_TAIL_ROOTS = [process.cwd(), '/var/log', homedir()];
// Credential stores under $HOME that must never be tail-able.
const BLOCKED_TAIL_PREFIXES = ['.ssh', '.gnupg', '.aws', '.kube', '.docker'].map(d =>
  join(homedir(), d)
);

function assertTailablePath(userPath: string): string {
  const resolved = resolve(userPath);
  const allowed = ALLOWED_TAIL_ROOTS.some(root => resolved.startsWith(root + '/'));
  if (!allowed) {
    throw new Error(`Access denied — tailing is limited to ${ALLOWED_TAIL_ROOTS.join(', ')}`);
  }
  if (BLOCKED_TAIL_PREFIXES.some(p => resolved === p || resolved.startsWith(p + '/'))) {
    throw new Error('Access denied — path contains credentials');
  }
  return resolved;
}

export async function startTailing(file: LogFile): Promise<{ success: boolean; message: string }> {
  try {
    const resolvedPath = assertTailablePath(file.path);

    const st = await stat(resolvedPath);
    if (!st.isFile()) {
      throw new Error(`Not a file: ${resolvedPath}`);
    }

    // Stop existing tail for this file
    if (tailProcesses.has(file.id)) {
      stopTailing(file.id);
    }

    // Start tail process
    const tailProcess = spawn('tail', ['-f', '-n', '50', resolvedPath], {
      shell: false,
    });

    const processData: TailProcess = {
      process: tailProcess,
      buffer: [],
      file,
    };

    tailProcesses.set(file.id, processData);

    tailProcess.stdout.on('data', (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .filter(line => line.trim());

      for (const line of lines) {
        const logLine: LogLine = {
          id: `${file.id}-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          source: file.name,
          level: detectLogLevel(line),
          message: line,
          color: file.color,
        };

        processData.buffer.push(logLine);

        // Keep only last 500 lines per file
        if (processData.buffer.length > 500) {
          processData.buffer.shift();
        }
      }
    });

    tailProcess.stderr.on('data', (data: Buffer) => {
      console.error(`[LogAggregator] Tail error for ${file.name}:`, data.toString());
    });

    tailProcess.on('close', (code: number) => {
      console.log(`[LogAggregator] Tail process for ${file.name} exited with code ${code}`);
      tailProcesses.delete(file.id);
    });

    tailProcess.on('error', (error: Error) => {
      console.error(`[LogAggregator] Tail process error for ${file.name}:`, error);
      tailProcesses.delete(file.id);
    });

    return { success: true, message: `Started tailing ${file.name}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start tailing',
    };
  }
}

export function stopTailing(fileId: string): { success: boolean; message: string } {
  const processData = tailProcesses.get(fileId);

  if (!processData) {
    return { success: false, message: 'Tail process not found' };
  }

  try {
    processData.process.kill('SIGTERM');
    tailProcesses.delete(fileId);
    return { success: true, message: 'Stopped tailing' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop tailing',
    };
  }
}

export function stopAllTailing(): void {
  for (const [fileId] of tailProcesses) {
    stopTailing(fileId);
  }
}

export function getLogLines(fileIds?: string[]): LogLine[] {
  const allLines: LogLine[] = [];

  for (const [fileId, processData] of tailProcesses) {
    if (!fileIds || fileIds.includes(fileId)) {
      allLines.push(...processData.buffer);
    }
  }

  // Sort by timestamp
  allLines.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return allLines;
}

export function getActiveTails(): LogFile[] {
  return Array.from(tailProcesses.values()).map(p => p.file);
}

export function assignColor(): string {
  const color = colors[colorIndex % colors.length];
  colorIndex++;
  return color;
}

export function clearLogs(fileId?: string): void {
  if (fileId) {
    const processData = tailProcesses.get(fileId);
    if (processData) {
      processData.buffer = [];
    }
  } else {
    // Clear all
    for (const processData of tailProcesses.values()) {
      processData.buffer = [];
    }
  }
}

// Curated, categorized suggestions for typical Linux/dev/AI-agent log files.
// `~` is expanded via os.homedir() so paths are concrete and directly tail-able.
// Only paths that exist, are regular files, AND pass the tail allowlist are
// returned — everything offered here is guaranteed to be tail-able.
export async function getCommonLogSuggestions(
  repoPath: string = process.cwd()
): Promise<LogSuggestion[]> {
  const candidates = logSuggestionCandidates(repoPath);
  const checks = await Promise.all(
    candidates.map(async s => {
      try {
        assertTailablePath(s.path);
        return (await stat(s.path)).isFile() ? s : null;
      } catch {
        return null;
      }
    })
  );
  return checks.filter((s): s is LogSuggestion => s !== null);
}

function logSuggestionCandidates(repoPath: string): LogSuggestion[] {
  const home = homedir();
  return [
    // ---- System (Linux) ----
    { category: 'System', name: 'syslog', path: '/var/log/syslog' },
    { category: 'System', name: 'auth.log', path: '/var/log/auth.log' },
    { category: 'System', name: 'kern.log', path: '/var/log/kern.log' },
    { category: 'System', name: 'messages', path: '/var/log/messages' },
    { category: 'System', name: 'secure', path: '/var/log/secure' },
    { category: 'System', name: 'daemon.log', path: '/var/log/daemon.log' },
    { category: 'System', name: 'cron', path: '/var/log/cron' },
    { category: 'System', name: 'dmesg', path: '/var/log/dmesg' },
    // ---- Services ----
    { category: 'Services', name: 'nginx access', path: '/var/log/nginx/access.log' },
    { category: 'Services', name: 'nginx error', path: '/var/log/nginx/error.log' },
    { category: 'Services', name: 'apache access', path: '/var/log/apache2/access.log' },
    { category: 'Services', name: 'apache error', path: '/var/log/apache2/error.log' },
    { category: 'Services', name: 'docker', path: '/var/log/docker.log' },
    { category: 'Services', name: 'fail2ban', path: '/var/log/fail2ban.log' },
    // ---- Dev environment ----
    { category: 'Dev', name: 'app.log', path: join(repoPath, 'logs/app.log') },
    { category: 'Dev', name: 'error.log', path: join(repoPath, 'logs/error.log') },
    { category: 'Dev', name: 'frontend.log', path: join(repoPath, 'frontend.log') },
    { category: 'Dev', name: 'backend.log', path: join(repoPath, 'backend.log') },
    { category: 'Dev', name: 'npm debug', path: join(home, '.npm/_logs/debug.log') },
    { category: 'Dev', name: 'pm2', path: join(home, '.pm2/pm2.log') },
    // ---- AI agents ----
    { category: 'AI Agents', name: 'Aider', path: join(home, '.aider.chat.log.md') },
  ];
}
