import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// UFW log entry interface
export interface UFWLogEntry {
  timestamp: Date;
  action: 'BLOCK' | 'ALLOW';
  protocol: string;
  srcIp: string;
  srcPort?: number;
  dstIp: string;
  dstPort?: number;
  interface?: string;
  raw: string;
}

// UFW firewall rule interface
export interface UFWRule {
  num: number;
  to: string;
  action: string;
  from: string;
  description?: string;
}

// UFW status interface
export interface UFWStatus {
  active: boolean;
  logging: string;
  defaultIncoming: string;
  defaultOutgoing: string;
  defaultRouted: string;
  rules: UFWRule[];
}

// Top attacker statistics
export interface AttackerStats {
  ip: string;
  blockedCount: number;
  lastSeen: Date;
  targetPorts: number[];
}

// Parse UFW log line (from kern.log or syslog)
// Example format: Dec 28 14:23:15 hostname kernel: [UFW BLOCK] IN=eth0 OUT= MAC=... SRC=1.2.3.4 DST=5.6.7.8 PROTO=TCP SPT=12345 DPT=22
function parseUFWLogLine(line: string): UFWLogEntry | null {
  const ufwMatch = line.match(/\[UFW (BLOCK|ALLOW)\]/);
  if (!ufwMatch) return null;

  const action = ufwMatch[1] as 'BLOCK' | 'ALLOW';

  // Extract timestamp (assuming standard syslog format)
  const timestampMatch = line.match(/^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
  const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();

  // Extract network details
  const srcMatch = line.match(/SRC=([\d.]+)/);
  const dstMatch = line.match(/DST=([\d.]+)/);
  const protoMatch = line.match(/PROTO=(\w+)/);
  const sportMatch = line.match(/SPT=(\d+)/);
  const dportMatch = line.match(/DPT=(\d+)/);
  const inMatch = line.match(/IN=(\w+)/);

  return {
    timestamp,
    action,
    protocol: protoMatch?.[1] || 'UNKNOWN',
    srcIp: srcMatch?.[1] || '0.0.0.0',
    srcPort: sportMatch ? parseInt(sportMatch[1]) : undefined,
    dstIp: dstMatch?.[1] || '0.0.0.0',
    dstPort: dportMatch ? parseInt(dportMatch[1]) : undefined,
    interface: inMatch?.[1],
    raw: line,
  };
}

// Get UFW logs (last N entries)
export async function getUFWLogs(limit = 100): Promise<UFWLogEntry[]> {
  try {
    // Try kern.log first, fallback to syslog
    let logs: string;
    try {
      const { stdout } = await execAsync(`sudo grep -i "UFW" /var/log/kern.log | tail -n ${limit}`);
      logs = stdout;
    } catch {
      const { stdout } = await execAsync(`sudo grep -i "UFW" /var/log/syslog | tail -n ${limit}`);
      logs = stdout;
    }

    const lines = logs.split('\n').filter(l => l.trim());
    const entries = lines
      .map(parseUFWLogLine)
      .filter((entry): entry is UFWLogEntry => entry !== null)
      .reverse(); // Most recent first

    return entries;
  } catch (error) {
    console.error('Failed to fetch UFW logs:', error);
    return [];
  }
}

// Get UFW status and rules
export async function getUFWStatus(): Promise<UFWStatus> {
  try {
    // Get verbose status
    const { stdout: statusOutput } = await execAsync('sudo ufw status verbose');

    const lines = statusOutput.split('\n');
    const active = lines[0]?.includes('active') || false;

    // Parse default policies
    const loggingMatch = statusOutput.match(/Logging:\s+(.+)/);
    const defaultInMatch = statusOutput.match(/Default:\s+(\w+)\s+\(incoming\)/);
    const defaultOutMatch = statusOutput.match(
      /Default:\s+\w+\s+\(incoming\),\s+(\w+)\s+\(outgoing\)/
    );
    const defaultRoutedMatch = statusOutput.match(
      /Default:\s+\w+\s+\(incoming\),\s+\w+\s+\(outgoing\),\s+(\w+)\s+\(routed\)/
    );

    // Get numbered rules
    let rules: UFWRule[] = [];
    try {
      const { stdout: rulesOutput } = await execAsync('sudo ufw status numbered');
      const ruleLines = rulesOutput.split('\n').filter(l => l.match(/^\[\s*\d+\]/));

      rules = ruleLines.map(line => {
        const numMatch = line.match(/^\[\s*(\d+)\]/);
        const num = numMatch ? parseInt(numMatch[1]) : 0;

        // Extract rule parts (simplified parsing)
        const parts = line.replace(/^\[\s*\d+\]\s*/, '').split(/\s{2,}/);

        return {
          num,
          to: parts[0] || '',
          action: parts[1] || '',
          from: parts[2] || '',
          description: parts[3],
        };
      });
    } catch {
      // If numbered rules fail, continue with empty array
    }

    return {
      active,
      logging: loggingMatch?.[1] || 'unknown',
      defaultIncoming: defaultInMatch?.[1] || 'unknown',
      defaultOutgoing: defaultOutMatch?.[1] || 'unknown',
      defaultRouted: defaultRoutedMatch?.[1] || 'unknown',
      rules,
    };
  } catch (error) {
    console.error('Failed to fetch UFW status:', error);
    return {
      active: false,
      logging: 'unknown',
      defaultIncoming: 'unknown',
      defaultOutgoing: 'unknown',
      defaultRouted: 'unknown',
      rules: [],
    };
  }
}

// Get top attacker IPs (IPs with most blocks)
export async function getTopAttackers(limit = 10): Promise<AttackerStats[]> {
  try {
    const logs = await getUFWLogs(1000); // Analyze last 1000 entries
    const blockedLogs = logs.filter(log => log.action === 'BLOCK');

    // Aggregate by source IP
    const attackerMap = new Map<string, { count: number; lastSeen: Date; ports: Set<number> }>();

    for (const log of blockedLogs) {
      const existing = attackerMap.get(log.srcIp);
      if (existing) {
        existing.count++;
        if (log.timestamp > existing.lastSeen) {
          existing.lastSeen = log.timestamp;
        }
        if (log.dstPort) {
          existing.ports.add(log.dstPort);
        }
      } else {
        attackerMap.set(log.srcIp, {
          count: 1,
          lastSeen: log.timestamp,
          ports: new Set(log.dstPort ? [log.dstPort] : []),
        });
      }
    }

    // Convert to array and sort by count
    const attackers: AttackerStats[] = Array.from(attackerMap.entries())
      .map(([ip, data]) => ({
        ip,
        blockedCount: data.count,
        lastSeen: data.lastSeen,
        targetPorts: Array.from(data.ports).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.blockedCount - a.blockedCount)
      .slice(0, limit);

    return attackers;
  } catch (error) {
    console.error('Failed to analyze attackers:', error);
    return [];
  }
}
