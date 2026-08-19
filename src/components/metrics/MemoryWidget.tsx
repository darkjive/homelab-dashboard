import { Activity } from 'lucide-react';
import { MetricsShell } from './MetricsShell';

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function MemoryWidget() {
  return (
    <MetricsShell title="MEMORY" icon={<Activity className="text-cyber-orange w-5 h-5" />}>
      {metrics => (
        <div className="space-y-3">
          <div className="metric-value text-cyber-orange">{metrics.memory.percentage}%</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Used:</span>
              <span className="text-cyber-cyan">{formatBytes(metrics.memory.used)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Free:</span>
              <span className="text-cyber-cyan">{formatBytes(metrics.memory.free)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total:</span>
              <span className="text-cyber-cyan font-bold">{formatBytes(metrics.memory.total)}</span>
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-cyber-cyan to-cyber-orange h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.memory.percentage}%` }}
            />
          </div>
        </div>
      )}
    </MetricsShell>
  );
}
