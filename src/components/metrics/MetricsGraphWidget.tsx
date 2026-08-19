import { LineChart as LineChartIcon } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricsShell } from './MetricsShell';
import { useMetrics } from '../../lib/metricsStore';

export function MetricsGraphWidget() {
  const { history } = useMetrics();

  return (
    <MetricsShell
      title="REAL-TIME PERFORMANCE"
      icon={<LineChartIcon className="text-cyber-cyan w-5 h-5" />}
    >
      {() => (
        <div className="space-y-2 h-full flex flex-col">
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 195, 255, 0.1)" />
                <XAxis dataKey="time" stroke="rgba(0, 195, 255, 0.5)" />
                <YAxis stroke="rgba(0, 195, 255, 0.5)" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#151a2e',
                    border: '1px solid rgba(0, 195, 255, 0.3)',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="rgb(0, 195, 255)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="rgb(255, 135, 0)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-cyan rounded" />
              <span>CPU</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-orange rounded" />
              <span>Memory</span>
            </div>
          </div>
        </div>
      )}
    </MetricsShell>
  );
}
