import { spawn, ChildProcess } from 'child_process';
import { access } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';

export interface LogFile {
  id: string;
  name: string;
  path: string;
  color: string;
}

export interface LogLine {
  id: string;
  timestamp: string;
  source: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN';
  message: string;
  color: string;
}

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

export function detectLogLevel(line: string): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN' {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('ERR') || upper.includes('FATAL')) return 'ERROR';
  if (upper.includes('WARN') || upper.includes('WARNING')) return 'WARN';
  if (upper.includes('INFO')) return 'INFO';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'UNKNOWN';
}

export async function startTailing(file: LogFile): Promise<{ success: boolean; message: string }> {
  try {
    // Validate path to prevent path traversal attacks
    const safeBasePath = process.cwd();
    const resolvedPath = resolve(file.path);

    if (!resolvedPath.startsWith(safeBasePath + '/')) {
      throw new Error('Path traversal detected - access denied');
    }

    // Check if file exists
    await access(resolvedPath);

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

// Common log file paths to suggest. Mixes project-local (always available)
// with conventional system paths across distros — caller should filter to
// existing files.
export function getCommonLogPaths(repoPath: string = process.cwd()): string[] {
  return getCommonLogSuggestions(repoPath).map(s => s.path);
}

export interface LogSuggestion {
  category: 'System' | 'Services' | 'Dev' | 'AI Agents';
  name: string;
  path: string;
}

// Curated, categorized suggestions for typical Linux/dev/AI-agent log files.
// `~` is expanded via os.homedir() so paths are concrete and directly tail-able.
export function getCommonLogSuggestions(repoPath: string = process.cwd()): LogSuggestion[] {
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
    { category: 'Dev', name: 'VSCode', path: join(home, '.config/Code/logs') },
    { category: 'Dev', name: 'pm2', path: join(home, '.pm2/pm2.log') },
    // ---- AI agents ----
    { category: 'AI Agents', name: 'Claude Code', path: join(home, '.claude/logs') },
    { category: 'AI Agents', name: 'OpenCode', path: join(home, '.local/share/opencode/log') },
    { category: 'AI Agents', name: 'Cursor', path: join(home, '.config/Cursor/logs') },
    { category: 'AI Agents', name: 'Continue', path: join(home, '.continue/sessions') },
    { category: 'AI Agents', name: 'Aider', path: join(home, '.aider.chat.log.md') },
    { category: 'AI Agents', name: 'Gemini CLI', path: join(home, '.gemini/tmp') },
  ];
}
