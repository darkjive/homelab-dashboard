import { useState, useEffect, useRef } from 'react';
import { Cpu, HardDrive, Activity, Thermometer } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MetricsData {
  cpu: { usage: string; cores: { usage: string }[] };
  memory: { total: number; used: number; free: number; percentage: string };
  disk: { fs: string; mount: string; size: number; used: number; percentage: number }[];
  temperature: { main: number; max: number; cores: number[]; available: boolean; reason?: string };
  platform?: string;
  timestamp: number;
}

interface HistoricalData {
  time: string;
  cpu: number;
  memory: number;
}

export function SystemMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [history, setHistory] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let isUnmounting = false;
    let wsFailCount = 0;
    const MAX_WS_FAILS = 3;

    // HTTP Polling fallback
    const startPolling = () => {
      console.log('[SystemMetrics] Falling back to HTTP polling');
      setConnectionStatus('connected');
      setLoading(false);

      const fetchMetrics = async () => {
        try {
          // Use relative URL to leverage Vite proxy
          const response = await fetch('/api/metrics');
          if (!response.ok) throw new Error('HTTP error');

          const data: MetricsData = await response.json();
          if (!data.cpu || !data.memory) return;

          setMetrics(data);
          setError(null);

          const now = new Date().toLocaleTimeString();
          setHistory(prev => {
            const newHistory = [
              ...prev,
              {
                time: now,
                cpu: parseFloat(data.cpu.usage),
                memory: parseFloat(data.memory.percentage),
              },
            ].slice(-20);
            return newHistory;
          });
        } catch (err) {
          console.error('[SystemMetrics] Polling error:', err);
          setError('Cannot reach metrics service');
        }
      };

      fetchMetrics();
      pollingInterval = setInterval(fetchMetrics, 2000);
    };

    const connectWebSocket = () => {
      if (isUnmounting || wsFailCount >= MAX_WS_FAILS) {
        if (wsFailCount >= MAX_WS_FAILS) {
          startPolling();
        }
        return;
      }

      try {
        setConnectionStatus('connecting');
        // Connect directly to backend WebSocket (Vite proxy doesn't work reliably for WS)
        const wsUrl = 'ws://localhost:3010/ws';
        console.log('[SystemMetrics] Connecting to:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let openHandled = false;

        // Timeout if connection takes too long
        const connectTimeout = setTimeout(() => {
          if (!openHandled) {
            console.warn('[SystemMetrics] WebSocket timeout');
            ws.close();
            wsFailCount++;
            if (wsFailCount >= MAX_WS_FAILS) {
              startPolling();
            } else {
              reconnectTimeout = setTimeout(connectWebSocket, 2000);
            }
          }
        }, 5000);

        ws.onopen = () => {
          openHandled = true;
          clearTimeout(connectTimeout);
          wsFailCount = 0; // Reset fail counter on success
          setConnectionStatus('connected');
          setLoading(false);
          setError(null);
          console.log('[SystemMetrics] WebSocket connected');
        };

        ws.onmessage = event => {
          try {
            const data: MetricsData = JSON.parse(event.data);

            if (!data.cpu || !data.memory) {
              return;
            }

            setMetrics(data);

            const now = new Date().toLocaleTimeString();
            setHistory(prev => {
              const newHistory = [
                ...prev,
                {
                  time: now,
                  cpu: parseFloat(data.cpu.usage),
                  memory: parseFloat(data.memory.percentage),
                },
              ].slice(-20);
              return newHistory;
            });
          } catch {
            // Silent parse error
          }
        };

        ws.onerror = error => {
          console.error('[SystemMetrics] WebSocket error:', error);
          clearTimeout(connectTimeout);
          if (!isUnmounting && !openHandled) {
            wsFailCount++;
            setError('WebSocket connection failed');
            setConnectionStatus('disconnected');
          }
        };

        ws.onclose = event => {
          clearTimeout(connectTimeout);
          console.log('[SystemMetrics] WebSocket closed:', event.code, event.reason);

          if (!isUnmounting) {
            setConnectionStatus('disconnected');

            if (!openHandled) {
              wsFailCount++;
            }

            if (wsFailCount >= MAX_WS_FAILS) {
              startPolling();
            } else {
              reconnectTimeout = setTimeout(() => {
                connectWebSocket();
              }, 5000);
            }
          }
        };
      } catch (err) {
        console.error('[SystemMetrics] WebSocket creation failed:', err);
        wsFailCount++;
        if (!isUnmounting) {
          if (wsFailCount >= MAX_WS_FAILS) {
            startPolling();
          } else {
            setError('Failed to connect to metrics service');
            setLoading(false);
          }
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounting = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-cyber-cyan">
          CONNECTING TO METRICS STREAM<span className="blink-cursor"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-500">⚠️ {error}</div>
        <div className="text-gray-400 text-sm">
          {connectionStatus === 'disconnected' && 'Attempting to reconnect...'}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Waiting for metrics data...</div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Indicator */}
      <div className="flex items-center justify-end gap-2 text-xs">
        <div
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500 animate-pulse'
              : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
          }`}
        ></div>
        <span className="text-gray-400">
          {connectionStatus === 'connected' && 'LIVE'}
          {connectionStatus === 'connecting' && 'CONNECTING...'}
          {connectionStatus === 'disconnected' && 'DISCONNECTED'}
        </span>
      </div>

      {/* CPU & Memory Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="cyber-card">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="text-cyber-cyan w-6 h-6" />
            <h3 className="text-xl font-bold cyber-glow">CPU USAGE</h3>
          </div>
          <div className="metric-value">{metrics.cpu.usage}%</div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {metrics.cpu.cores.slice(0, 16).map((core, i) => (
              <div key={i} className="text-xs">
                <div className="text-gray-400">Core {i}</div>
                <div
                  className={`font-bold ${parseFloat(core.usage) > 80 ? 'text-cyber-orange' : 'text-cyber-cyan'}`}
                >
                  {core.usage}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cyber-card">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-cyber-orange w-6 h-6" />
            <h3 className="text-xl font-bold text-cyber-orange">MEMORY</h3>
          </div>
          <div className="metric-value text-cyber-orange">{metrics.memory.percentage}%</div>
          <div className="mt-4 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Used:</span>
              <span className="text-cyber-cyan">{formatBytes(metrics.memory.used)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Free:</span>
              <span className="text-cyber-cyan">{formatBytes(metrics.memory.free)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total:</span>
              <span className="text-cyber-cyan font-bold">{formatBytes(metrics.memory.total)}</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-cyber-cyan to-cyber-orange h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.memory.percentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Live Graph */}
      <div className="cyber-card">
        <h3 className="text-xl font-bold cyber-glow mb-4">REAL-TIME PERFORMANCE</h3>
        <ResponsiveContainer width="100%" height={250}>
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
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cyber-cyan rounded"></div>
            <span>CPU</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cyber-orange rounded"></div>
            <span>Memory</span>
          </div>
        </div>
      </div>

      {/* Storage */}
      <div className="cyber-card">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="text-cyber-cyan w-6 h-6" />
          <h3 className="text-xl font-bold cyber-glow">STORAGE</h3>
        </div>
        {metrics.disk.length > 0 ? (
          <div className="space-y-4">
            {metrics.disk.slice(0, 3).map((disk, i) => (
              <div
                key={i}
                className="border-t border-cyber-border pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 font-mono text-sm">{disk.mount}</span>
                  <span className="text-cyber-cyan font-bold">{disk.percentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">
                    {formatBytes(disk.used)} / {formatBytes(disk.size)}
                  </span>
                  <span className="text-gray-500">{formatBytes(disk.size - disk.used)} free</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      disk.percentage > 90
                        ? 'bg-red-500'
                        : disk.percentage > 70
                          ? 'bg-cyber-orange'
                          : 'bg-cyber-cyan'
                    }`}
                    style={{ width: `${disk.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400">No storage devices detected</div>
        )}
      </div>

      {/* Temperature */}
      <div className="cyber-card">
        <div className="flex items-center gap-3 mb-4">
          <Thermometer className="text-cyber-orange w-6 h-6" />
          <h3 className="text-xl font-bold text-cyber-orange">TEMPERATURE</h3>
        </div>
        {metrics.temperature.available ? (
          <>
            <div className="text-4xl font-bold text-cyber-orange">
              {metrics.temperature.main.toFixed(1)}°C
            </div>
            <div className="text-sm text-gray-400 mt-2">
              Max: {metrics.temperature.max.toFixed(1)}°C
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-gray-400 text-lg">Not Available</div>
            <div className="text-xs text-gray-500 border-l-2 border-gray-700 pl-3">
              {metrics.temperature.reason || 'Temperature sensors not detected'}
            </div>
            {metrics.platform === 'win32' && (
              <div className="text-xs text-cyber-cyan mt-2">
                💡 Windows users can try tools like HWiNFO or Core Temp for detailed temperature
                monitoring
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
