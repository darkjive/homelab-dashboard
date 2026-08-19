import { Cpu } from 'lucide-react';
import { MetricsShell } from './MetricsShell';

export function CpuWidget() {
  return (
    <MetricsShell title="CPU USAGE" icon={<Cpu className="text-cyber-cyan w-5 h-5" />}>
      {metrics => (
        <div className="space-y-3">
          <div className="metric-value">{metrics.cpu.usage}%</div>
          <div className="grid grid-cols-4 gap-2">
            {metrics.cpu.cores.slice(0, 16).map((core, i) => (
              <div key={i} className="text-xs">
                <div className="text-gray-400">Core {i}</div>
                <div
                  className={`font-bold ${
                    parseFloat(core.usage) > 80 ? 'text-cyber-orange' : 'text-cyber-cyan'
                  }`}
                >
                  {core.usage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MetricsShell>
  );
}
