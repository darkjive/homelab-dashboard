import { exec } from 'child_process';
import { promisify } from 'util';
import type { DevPortInfo } from '../../shared/types.js';

const execAsync = promisify(exec);

// Common dev ports to always check
const DEV_PORTS = [3000, 3010, 4000, 4173, 5000, 5173, 5432, 8000, 8080, 8888, 9000, 27017];

// True if `lsof` is on PATH. Widget degrades to empty list if absent.
export async function getPortKillerStatus(): Promise<{ available: boolean; error?: string }> {
  try {
    await execAsync('command -v lsof');
    return { available: true };
  } catch {
    return {
      available: false,
      error: "lsof not found on PATH — install it (Debian: 'lsof', NixOS: 'pkgs.lsof')",
    };
  }
}

export async function getActiveDevPorts(): Promise<DevPortInfo[]> {
  const ports: DevPortInfo[] = [];

  try {
    // Use lsof to find processes listening on dev ports
    const { stdout } = await execAsync(`lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || true`, {
      maxBuffer: 1024 * 1024,
    });

    const lines = stdout.split('\n').slice(1); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const processName = parts[0];
      const pid = parseInt(parts[1]);
      const protocol = parts[7].toLowerCase();
      const address = parts[8];

      // Extract port from address like "*:3000" or "127.0.0.1:5173"
      const portMatch = address.match(/:(\d+)$/);
      if (!portMatch) continue;

      const port = parseInt(portMatch[1]);

      // Only include dev-relevant ports
      if (!DEV_PORTS.includes(port) && port < 3000) continue;

      ports.push({
        port,
        pid,
        protocol: protocol.includes('tcp') ? 'TCP' : 'UDP',
        processName,
        command: processName, // full command resolved in one batch below
      });
    }

    // Resolve full commands in a single ps call instead of one per PID
    if (ports.length > 0) {
      const pids = [...new Set(ports.map(p => p.pid))].join(',');
      try {
        const { stdout: psOutput } = await execAsync(
          `ps -p ${pids} -o pid=,command= 2>/dev/null || true`,
          { maxBuffer: 1024 * 1024 }
        );
        const commands = new Map<number, string>();
        for (const line of psOutput.split('\n')) {
          const m = line.match(/^\s*(\d+)\s+(.*)$/);
          if (m) commands.set(parseInt(m[1]), m[2].trim());
        }
        for (const p of ports) {
          const cmd = commands.get(p.pid);
          if (cmd) p.command = cmd.substring(0, 100); // Limit length
        }
      } catch {
        // Fallback: process name already set
      }
    }
  } catch (error) {
    console.error('[PortKiller] Failed to scan ports:', error);
  }

  // Sort by port number
  return ports.sort((a, b) => a.port - b.port);
}

export async function killProcess(pid: number): Promise<{ success: boolean; message: string }> {
  try {
    // Try graceful kill first (SIGTERM)
    await execAsync(`kill ${pid}`);

    // Wait a bit to check if process is still alive
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      await execAsync(`ps -p ${pid} 2>/dev/null`);
      // Process still alive, force kill
      await execAsync(`kill -9 ${pid}`);
      return { success: true, message: `Process ${pid} force killed (SIGKILL)` };
    } catch {
      // Process is dead (ps failed)
      return { success: true, message: `Process ${pid} terminated gracefully` };
    }
  } catch (error) {
    console.error(`[PortKiller] Failed to kill process ${pid}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to kill process',
    };
  }
}

export async function killPortProcess(
  port: number
): Promise<{ success: boolean; message: string }> {
  try {
    const ports = await getActiveDevPorts();
    const portInfo = ports.find(p => p.port === port);

    if (!portInfo) {
      return { success: false, message: `No process found on port ${port}` };
    }

    return await killProcess(portInfo.pid);
  } catch (error) {
    console.error(`[PortKiller] Failed to kill process on port ${port}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to kill process',
    };
  }
}
