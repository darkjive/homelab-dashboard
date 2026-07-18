import si from 'systeminformation';
import os from 'os';

export interface MetricsData {
  cpu: { usage: string; cores: { usage: string }[] };
  memory: { total: number; used: number; free: number; percentage: string };
  disk: { fs: string; mount: string; size: number; used: number; percentage: number }[];
  temperature: { main: number; max: number; cores: number[]; available: boolean; reason?: string };
  platform: NodeJS.Platform;
  timestamp: number;
}

export async function getSystemMetrics(): Promise<MetricsData> {
  try {
    const [cpu, mem, disk, temp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.cpuTemperature(),
    ]);

    // Detect if temperature sensors are available
    const tempAvailable = temp.main !== null && temp.main > 0;
    let tempReason: string | undefined;

    if (!tempAvailable) {
      const platform = os.platform();
      if (platform === 'win32') {
        tempReason =
          'Temperature sensors typically require admin privileges or specialized drivers on Windows';
      } else if (platform === 'darwin') {
        tempReason = 'Temperature sensors may not be accessible on macOS without additional tools';
      } else {
        tempReason = 'Temperature sensors not detected or not accessible';
      }
    }

    return {
      cpu: {
        usage: cpu.currentLoad.toFixed(1),
        cores: cpu.cpus.map(core => ({
          usage: core.load.toFixed(1),
        })),
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        percentage: ((mem.used / mem.total) * 100).toFixed(1),
      },
      disk: disk
        .filter(d => d.size > 0) // Filter out invalid drives
        .map(d => ({
          fs: d.fs,
          mount: d.mount,
          size: d.size,
          used: d.used,
          percentage: (d.used / d.size) * 100,
        })),
      temperature: {
        main: temp.main || 0,
        max: temp.max || 0,
        cores: temp.cores || [],
        available: tempAvailable,
        reason: tempReason,
      },
      platform: os.platform(),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch system metrics:', error);
    // Return fallback data instead of throwing to prevent server crash
    return {
      cpu: { usage: '0', cores: [] },
      memory: { total: 0, used: 0, free: 0, percentage: '0' },
      disk: [],
      temperature: {
        main: 0,
        max: 0,
        cores: [],
        available: false,
        reason: 'Failed to fetch temperature data',
      },
      platform: os.platform(),
      timestamp: Date.now(),
    };
  }
}
