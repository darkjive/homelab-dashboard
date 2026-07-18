import { useState, useEffect } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import { SystemMetrics } from './components/SystemMetrics';
import { WeatherWidget } from './components/WeatherWidget';
import { GitHubStats } from './components/GitHubStats';
import { ChatBot } from './components/ChatBot';
import { QuickLinks } from './components/QuickLinks';
import { ServiceStatus } from './components/ServiceStatus';
import { NetworkOutageMap } from './components/NetworkOutageMap';
import { HackerNewsFeed } from './components/HackerNewsFeed';
import { CustomRSSFeed } from './components/CustomRSSFeed';
import { WebScraper } from './components/WebScraper';
import { MarkdownEditor } from './components/MarkdownEditor';
import { SoundManager } from './components/SoundManager';
import { PortKiller } from './components/PortKiller';
import { GitStatus } from './components/GitStatus';
import { NpmScriptRunner } from './components/NpmScriptRunner';
import { LogAggregator } from './components/LogAggregator';
import { DockerWidget } from './components/DockerWidget';
import { FirewallMonitor } from './components/FirewallMonitor';
import { SettingsPanel } from './components/SettingsPanel';
import { Boxes, RotateCcw, Eye, EyeOff, Save, Settings } from 'lucide-react';
import 'react-grid-layout/css/styles.css';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// 12-column grid layout with standardized sizes
// Widths: 3 (small), 6 (medium), 12 (large)
// Heights: 3 (compact), 4 (normal), 6 (tall)
const defaultLayout = [
  // Row 1: Hero Section - Chatbot + System Metrics
  { i: 'chatbot', x: 0, y: 0, w: 6, h: 6, minW: 6, minH: 6 },
  { i: 'metrics', x: 6, y: 0, w: 6, h: 6, minW: 6, minH: 6 },

  // Row 2: Dev Tools - Logs, Git, NPM
  { i: 'log-aggregator', x: 0, y: 6, w: 6, h: 6, minW: 6, minH: 6 },
  { i: 'git-status', x: 6, y: 6, w: 3, h: 6, minW: 3, minH: 4 },
  { i: 'npm-script-runner', x: 9, y: 6, w: 3, h: 6, minW: 3, minH: 4 },

  // Row 3: Services - Docker, GitHub, Service Status
  { i: 'docker', x: 0, y: 12, w: 4, h: 4, minW: 4, minH: 4 },
  { i: 'github', x: 4, y: 12, w: 4, h: 4, minW: 4, minH: 4 },
  { i: 'service-status', x: 8, y: 12, w: 4, h: 4, minW: 3, minH: 4 },

  // Row 4: Communication - Weather
  { i: 'weather', x: 0, y: 16, w: 12, h: 4, minW: 3, minH: 4 },

  // Row 5: Content - News, RSS
  { i: 'hacker-news', x: 0, y: 20, w: 3, h: 4, minW: 3, minH: 4 },
  { i: 'custom-rss', x: 3, y: 20, w: 9, h: 4, minW: 6, minH: 4 },

  // Row 6: Network Outage Map + Web Scraper
  { i: 'network-outage', x: 0, y: 24, w: 6, h: 4, minW: 6, minH: 4 },
  { i: 'web-scraper', x: 6, y: 24, w: 3, h: 4, minW: 3, minH: 3 },
  { i: 'port-killer', x: 9, y: 24, w: 3, h: 4, minW: 3, minH: 3 },

  // Row 7: Markdown Editor + Quick Links
  { i: 'markdown-editor', x: 0, y: 28, w: 9, h: 4, minW: 6, minH: 3 },
  { i: 'quick-links', x: 9, y: 28, w: 3, h: 4, minW: 3, minH: 3 },

  // Row 8: Security - Firewall Monitor
  { i: 'firewall-monitor', x: 0, y: 32, w: 6, h: 6, minW: 6, minH: 6 },
];

const defaultEnabledWidgets = {
  metrics: true,
  chatbot: true,
  'quick-links': true,
  'markdown-editor': true,
  'web-scraper': true,
  weather: true,
  github: true,
  'hacker-news': true,
  'custom-rss': true,
  'service-status': true,
  'network-outage': true,
  'port-killer': true,
  'git-status': true,
  'npm-script-runner': true,
  'log-aggregator': true,
  docker: true,
  'firewall-monitor': true,
};

type WidgetStatus = 'ready' | 'warning' | 'disabled';

interface WidgetHealth {
  status: WidgetStatus;
  message?: string;
}

const widgetConfig = {
  metrics: { name: '📊 SYSTEM METRICS', component: SystemMetrics },
  chatbot: { name: '🤖 AI CHATBOT', component: ChatBot },
  'quick-links': { name: '🔗 QUICK LINKS', component: QuickLinks },
  'markdown-editor': { name: '📝 MARKDOWN EDITOR', component: MarkdownEditor },
  'web-scraper': { name: '🌐 WEB SCRAPER', component: WebScraper },
  weather: { name: '🌦️ WEATHER', component: WeatherWidget },
  github: { name: '💻 GITHUB STATS', component: GitHubStats },
  'hacker-news': { name: '🔥 HACKER NEWS', component: HackerNewsFeed },
  'custom-rss': { name: '📡 CUSTOM RSS', component: CustomRSSFeed },
  'service-status': { name: '🌐 SERVICE STATUS', component: ServiceStatus },
  'network-outage': { name: '📡 NETWORK OUTAGES', component: NetworkOutageMap },
  'port-killer': { name: '⚡ PORT KILLER', component: PortKiller },
  'git-status': { name: '🔀 GIT STATUS', component: GitStatus },
  'npm-script-runner': { name: '📦 NPM SCRIPTS', component: NpmScriptRunner },
  'log-aggregator': { name: '📜 LOG AGGREGATOR', component: LogAggregator },
  docker: { name: '🐳 DOCKER', component: DockerWidget },
  'firewall-monitor': { name: '🔥 FIREWALL', component: FirewallMonitor },
};

function validateEnabledWidgets(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return Object.entries(data).every(
    ([key, value]) => typeof key === 'string' && typeof value === 'boolean' && key in widgetConfig
  );
}

// Check widget health (service availability, config status)
async function checkWidgetHealth(widgetId: string): Promise<WidgetHealth> {
  try {
    switch (widgetId) {
      case 'chatbot':
        // Check Ollama availability (silently fail without console spam)
        try {
          const res = await fetch('/api/ollama/api/tags', {
            signal: AbortSignal.timeout(3000),
          });
          if (!res.ok) {
            // Silent fail - don't log 404s repeatedly
            return { status: 'warning', message: 'Ollama server not running' };
          }
          return { status: 'ready' };
        } catch {
          // Silent fail - Ollama not running is expected
          return { status: 'warning', message: 'Ollama server not running' };
        }

      case 'web-scraper':
        // Check backend server
        try {
          const res = await fetch('/api/metrics', { signal: AbortSignal.timeout(3000) });
          if (!res.ok) throw new Error('Backend not available');
          return { status: 'ready' };
        } catch {
          return { status: 'warning', message: 'Backend server not running' };
        }

      default:
        // All other widgets have no external dependencies
        return { status: 'ready' };
    }
  } catch {
    return { status: 'warning', message: 'Service check failed' };
  }
}

function App() {
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard-layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            item =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.i === 'string' &&
              typeof item.x === 'number'
          )
        ) {
          return parsed;
        }
      }
    } catch {
      // Silent fallback to default
    }
    return defaultLayout;
  });

  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('enabled-widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validateEnabledWidgets(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Silent fallback to default
    }
    return defaultEnabledWidgets;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [showWidgetControls, setShowWidgetControls] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth - 48 : 2500
  );

  const [githubUsername, setGithubUsername] = useState(() => {
    return localStorage.getItem('github-username') || 'darkjive';
  });
  const [showSettings, setShowSettings] = useState(false);

  // Listen for settings changes (SettingsPanel dispatches via setSetting)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (!detail || detail.key === 'github-username') {
        setGithubUsername(localStorage.getItem('github-username') || 'darkjive');
      }
    };
    window.addEventListener('homelab:settings-changed', handler);
    return () => window.removeEventListener('homelab:settings-changed', handler);
  }, []);

  const [widgetHealth, setWidgetHealth] = useState<Record<string, WidgetHealth>>({});

  // Periodic health check for enabled widgets
  useEffect(() => {
    const checkAllWidgets = async () => {
      const healthChecks = await Promise.all(
        Object.keys(widgetConfig).map(async widgetId => {
          if (!enabledWidgets[widgetId]) {
            return [widgetId, { status: 'disabled' as WidgetStatus }];
          }
          const health = await checkWidgetHealth(widgetId);
          return [widgetId, health];
        })
      );
      setWidgetHealth(Object.fromEntries(healthChecks));
    };

    checkAllWidgets();
    const interval = setInterval(checkAllWidgets, 60000); // Check every 60s (reduced from 10s)
    return () => clearInterval(interval);
  }, [enabledWidgets]);

  const toggleWidget = (widgetId: string) => {
    setEnabledWidgets(prev => {
      const updated = { ...prev, [widgetId]: !prev[widgetId] };
      localStorage.setItem('enabled-widgets', JSON.stringify(updated));

      if (!prev[widgetId] && updated[widgetId]) {
        const existingItem = layout.find((item: { i: string }) => item.i === widgetId);
        if (!existingItem) {
          const maxY = layout.reduce(
            (max: number, item: LayoutItem) => Math.max(max, item.y + item.h),
            0
          );

          const newItem = {
            i: widgetId,
            x: 0,
            y: maxY,
            w: 12,
            h: 6,
            minW: 4,
            minH: 4,
          };

          const newLayout = [...layout, newItem];
          setLayout(newLayout);
          localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
        }
      }

      return updated;
    });
  };

  const manualSave = () => {
    localStorage.setItem('dashboard-layout', JSON.stringify(layout));
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const saveLayout = (newLayout: ReadonlyArray<LayoutItem>) => {
    setLayout(newLayout as LayoutItem[]);
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
  };

  const resetLayout = () => {
    // Reset to default layout but only include enabled widgets
    const resetLayout = defaultLayout.filter(item => enabledWidgets[item.i]);
    setLayout(resetLayout);
    localStorage.setItem('dashboard-layout', JSON.stringify(resetLayout));
  };

  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth - 48);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen">
      <header
        className="border-b border-cyber-border backdrop-blur-sm sticky top-0 z-50"
        style={{ backgroundColor: 'var(--color-cyber-darkbg)' }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Boxes className="w-8 h-8" style={{ color: 'var(--color-cyber-cyan)' }} />
              <div>
                <h1 className="text-2xl font-bold cyber-glow">
                  NXSCTRL.LAB<span className="blink-cursor"></span>
                </h1>
                <p className="text-xs text-gray-400">
                  Nexus Control Laboratory
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SoundManager />
              <div className="w-px h-6 bg-cyber-border" />
              <button
                onClick={() => setShowWidgetControls(!showWidgetControls)}
                className="cyber-button flex items-center gap-2 text-sm"
                title="Toggle Widgets"
              >
                {showWidgetControls ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">Widgets</span>
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`cyber-button flex items-center gap-2 text-sm ${showSettings ? 'bg-cyber-cyan/20' : ''}`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={manualSave}
                className={`cyber-button flex items-center gap-2 text-sm ${showSaved ? 'bg-green-500' : ''}`}
                title="Save Layout"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{showSaved ? 'Saved!' : 'Save'}</span>
              </button>
              <button
                onClick={resetLayout}
                className="cyber-button flex items-center gap-2 text-sm"
                title="Reset Layout to Default"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {showWidgetControls && (
            <div className="mt-4 pt-4 border-t border-cyber-border space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-cyber-cyan">WIDGET VISIBILITY</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Running</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 widget-pulse" />
                      <span>Warning</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Disabled</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {Object.entries(widgetConfig).map(([id, config]) => {
                    const health = widgetHealth[id] || { status: 'ready' };
                    const isEnabled = enabledWidgets[id];
                    const hasWarning = isEnabled && health.status === 'warning';

                    return (
                      <button
                        key={id}
                        onClick={() => toggleWidget(id)}
                        title={health.message || (isEnabled ? 'Enabled' : 'Disabled')}
                        className={`p-2 rounded text-xs font-mono transition-all flex items-center gap-2 relative ${
                          !isEnabled
                            ? 'bg-red-900/30 border border-red-500/50 text-red-300'
                            : hasWarning
                              ? 'bg-yellow-900/30 border border-yellow-500/50 text-yellow-300'
                              : 'bg-green-900/30 border border-green-500/50 text-green-300'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            !isEnabled
                              ? 'bg-red-500'
                              : hasWarning
                                ? 'bg-yellow-500 widget-pulse'
                                : 'bg-green-500'
                          }`}
                        />
                        <span className="truncate">{config.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </header>

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <div className="px-6 py-6">
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={containerWidth < 768 ? 80 : 120}
          width={containerWidth}
          onLayoutChange={saveLayout}
          onDragStart={() => setIsDragging(true)}
          onDragStop={() => setIsDragging(false)}
          draggableHandle=".drag-handle"
          isDraggable={true}
          isResizable={true}
          compactType="vertical"
          preventCollision={false}
        >
          {Object.entries(widgetConfig).map(([id, config]) => {
            if (!enabledWidgets[id]) return null;

            const WidgetComponent = config.component;

            return (
              <div
                key={id}
                className={isDragging ? 'dragging' : ''}
                style={{ pointerEvents: 'auto' }}
              >
                <div className="drag-handle cursor-move p-2 border-b border-cyber-border hover:bg-cyber-cyan/10 select-none">
                  <div className="text-xs font-bold text-gray-400">{config.name}</div>
                </div>
                <div
                  className="p-4 overflow-auto"
                  style={{ height: 'calc(100% - 48px)', pointerEvents: 'auto' }}
                >
                  {id === 'github' ? (
                    <WidgetComponent username={githubUsername} />
                  ) : (
                    <WidgetComponent />
                  )}
                </div>
              </div>
            );
          })}
        </GridLayout>

        <footer className="mt-12 py-6 border-t border-cyber-border text-center">
          <p className="text-sm text-gray-500">
            NXSCTRL.LAB // Powered by React 19 + Vite 7 + Tailwind 4
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Built with <span style={{ color: 'var(--color-cyber-cyan)' }}>Cyan</span> and{' '}
            <span style={{ color: 'var(--color-cyber-orange)' }}>Orange</span> // Drag widgets to
            customize
          </p>
          <p className="text-xs text-gray-700 mt-2">
            Crafted by <span style={{ color: 'var(--color-cyber-cyan)' }}>𐌀𐌋𐌀𐌉𐌍</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
