import { MemoryStick } from 'lucide-react';
import { MetricsShell } from './MetricsShell';

function formatMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}

export function VramWidget() {
  return (
    <MetricsShell title="VRAM" icon={<MemoryStick className="text-cyber-cyan w-5 h-5" />}>
      {metrics =>
        metrics.vram && metrics.vram.available ? (
          <div className="space-y-3">
            {metrics.vram.gpus.map((gpu, i) => (
              <div
                key={i}
                className="border-t border-cyber-border pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 font-mono text-xs truncate" title={gpu.model}>
                    {gpu.model}
                  </span>
                  {gpu.percentage !== undefined && (
                    <span className="text-cyber-cyan font-bold text-sm">{gpu.percentage}%</span>
                  )}
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500">
                    {gpu.usedMb !== undefined ? formatMb(gpu.usedMb) : '—'} /{' '}
                    {formatMb(gpu.totalMb)}
                  </span>
                  <span className="text-gray-500">{gpu.vendor}</span>
                </div>
                {gpu.percentage !== undefined && (
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-cyber-cyan to-cyber-orange"
                      style={{ width: `${gpu.percentage}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            {!metrics.vram.dynamic && metrics.vram.reason && (
              <div className="text-xs text-gray-500 border-l-2 border-gray-700 pl-3">
                {metrics.vram.reason}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400 text-sm">Not Available</div>
            <div className="text-xs text-gray-500 border-l-2 border-gray-700 pl-3">
              {metrics.vram?.reason || 'No GPU VRAM detected'}
            </div>
          </div>
        )
      }
    </MetricsShell>
  );
}
