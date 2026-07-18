import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Play,
  Square,
  Trash2,
  Plus,
  Filter,
  Download,
  Pause,
  PlayCircle,
  X,
} from 'lucide-react';

interface LogFile {
  id: string;
  name: string;
  path: string;
  color: string;
}

interface LogLine {
  id: string;
  timestamp: string;
  source: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN';
  message: string;
  color: string;
}

export function LogAggregator() {
  const [activeTails, setActiveTails] = useState<LogFile[]>([]);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState<Set<string>>(
    new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'UNKNOWN'])
  );

  // Add log file
  const [showAddLog, setShowAddLog] = useState(false);
  const [newLogName, setNewLogName] = useState('');
  const [newLogPath, setNewLogPath] = useState('');

  // Saved log configs
  const [savedLogs, setSavedLogs] = useState<Omit<LogFile, 'color'>[]>(() => {
    try {
      const saved = localStorage.getItem('log-configs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchActiveTails = async () => {
    try {
      const res = await fetch('http://localhost:3010/api/logs/active');
      const data = await res.json();
      setActiveTails(data.tails || []);
    } catch (error) {
      console.error('Failed to fetch active tails:', error);
    }
  };

  const fetchLogLines = async () => {
    try {
      const res = await fetch('http://localhost:3010/api/logs/lines');
      const data = await res.json();
      setLogLines(data.lines || []);
    } catch (error) {
      console.error('Failed to fetch log lines:', error);
    }
  };

  const startTailing = async (log: Omit<LogFile, 'color'>) => {
    try {
      const res = await fetch('http://localhost:3010/api/logs/tail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: log.id,
          name: log.name,
          path: log.path,
        }),
      });

      const result = await res.json();
      if (result.success) {
        await fetchActiveTails();
      } else {
        alert(`Failed to start tailing: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to start tailing:', error);
      alert('Failed to start tailing');
    }
  };

  const stopTailing = async (fileId: string) => {
    try {
      await fetch('http://localhost:3010/api/logs/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      await fetchActiveTails();
    } catch (error) {
      console.error('Failed to stop tailing:', error);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('http://localhost:3010/api/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      setLogLines([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const addLog = () => {
    if (!newLogName.trim() || !newLogPath.trim()) {
      alert('Both name and path are required');
      return;
    }

    const newLog = {
      id: `log-${Date.now()}`,
      name: newLogName.trim(),
      path: newLogPath.trim(),
    };

    const updated = [...savedLogs, newLog];
    setSavedLogs(updated);
    localStorage.setItem('log-configs', JSON.stringify(updated));

    // Auto-start tailing
    startTailing(newLog);

    setNewLogName('');
    setNewLogPath('');
    setShowAddLog(false);
  };

  const removeLog = (logId: string) => {
    const updated = savedLogs.filter(l => l.id !== logId);
    setSavedLogs(updated);
    localStorage.setItem('log-configs', JSON.stringify(updated));

    // Stop tailing if active
    if (activeTails.find(t => t.id === logId)) {
      stopTailing(logId);
    }
  };

  const toggleLevelFilter = (level: string) => {
    setLevelFilter(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const downloadLogs = () => {
    const text = filteredLines
      .map(line => `[${line.timestamp}] [${line.source}] [${line.level}] ${line.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchActiveTails();
    fetchLogLines();

    const interval = setInterval(() => {
      fetchLogLines();
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines, autoScroll]);

  const filteredLines = logLines.filter(line => levelFilter.has(line.level));

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-400';
      case 'WARN':
        return 'text-yellow-400';
      case 'INFO':
        return 'text-blue-400';
      case 'DEBUG':
        return 'text-gray-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-900/30 border-red-500/50 text-red-300';
      case 'WARN':
        return 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300';
      case 'INFO':
        return 'bg-blue-900/30 border-blue-500/50 text-blue-300';
      case 'DEBUG':
        return 'bg-gray-900/30 border-gray-500/50 text-gray-300';
      default:
        return 'bg-gray-900/30 border-gray-500/50 text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-cyber-border">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-cyber-cyan" />
          <div>
            <h3 className="text-xl font-bold cyber-glow">LOG AGGREGATOR</h3>
            <div className="text-xs text-gray-400">
              {activeTails.length} active • {filteredLines.length} lines
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`cyber-button p-2 ${autoScroll ? 'bg-green-600' : ''}`}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            {autoScroll ? <PlayCircle className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button onClick={downloadLogs} className="cyber-button p-2" title="Download logs">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={clearLogs} className="cyber-button p-2" title="Clear logs">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Level Filter */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {['ERROR', 'WARN', 'INFO', 'DEBUG', 'UNKNOWN'].map(level => (
          <button
            key={level}
            onClick={() => toggleLevelFilter(level)}
            className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
              levelFilter.has(level)
                ? getLevelBadgeColor(level)
                : 'bg-gray-800 border-gray-700 text-gray-600'
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Active Tails */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-gray-400">TAILING</span>
          <button
            onClick={() => setShowAddLog(!showAddLog)}
            className="cyber-button p-1"
            title="Add log file"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {showAddLog && (
          <div className="mb-2 p-2 bg-cyber-cardbg border border-cyber-cyan rounded">
            <input
              type="text"
              value={newLogName}
              onChange={e => setNewLogName(e.target.value)}
              placeholder="Log name (e.g., Backend)"
              className="w-full px-2 py-1 bg-cyber-darkbg border border-cyber-border text-gray-300 text-xs rounded mb-2"
            />
            <input
              type="text"
              value={newLogPath}
              onChange={e => setNewLogPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLog()}
              placeholder="Absolute path (e.g., /var/log/app.log)"
              className="w-full px-2 py-1 bg-cyber-darkbg border border-cyber-border text-gray-300 text-xs rounded mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={addLog}
                className="flex-1 bg-cyber-cyan text-black px-2 py-1 rounded text-xs font-bold hover:bg-cyber-orange"
              >
                Add & Start
              </button>
              <button
                onClick={() => {
                  setShowAddLog(false);
                  setNewLogName('');
                  setNewLogPath('');
                }}
                className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {savedLogs.map(log => {
            const isActive = activeTails.find(t => t.id === log.id);
            const activeLog = activeTails.find(t => t.id === log.id);

            return (
              <div
                key={log.id}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs border ${
                  isActive ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-800 border-gray-700'
                }`}
              >
                {isActive && activeLog && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: activeLog.color }}
                  />
                )}
                <span className="font-mono">{log.name}</span>
                <button
                  onClick={() => (isActive ? stopTailing(log.id) : startTailing(log))}
                  className="hover:text-cyber-cyan transition-colors"
                  title={isActive ? 'Stop tailing' : 'Start tailing'}
                >
                  {isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => removeLog(log.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Output */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-black rounded border border-cyber-border p-2 overflow-y-auto font-mono text-xs"
      >
        {filteredLines.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Add and start tailing log files above.
          </div>
        ) : (
          filteredLines.map(line => (
            <div key={line.id} className="mb-1 hover:bg-gray-900/50">
              <span className="text-gray-600">
                [{new Date(line.timestamp).toLocaleTimeString()}]
              </span>{' '}
              <span style={{ color: line.color }} className="font-bold">
                [{line.source}]
              </span>{' '}
              <span className={`font-bold ${getLevelColor(line.level)}`}>[{line.level}]</span>{' '}
              <span className="text-gray-300">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
