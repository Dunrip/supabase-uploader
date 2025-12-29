import { useState, useEffect, useRef } from 'react';

export default function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadLogs();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLogLevel = (line) => {
    if (line.includes('[ERROR]')) return 'error';
    if (line.includes('[SUCCESS]')) return 'success';
    if (line.includes('[INFO]')) return 'info';
    return 'default';
  };

  const formatLogLine = (line) => {
    const level = getLogLevel(line);
    const colors = {
      error: 'text-red-400',
      success: 'text-green-400',
      info: 'text-blue-400',
      default: 'text-dark-textMuted',
    };
    return colors[level] || colors.default;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all"
        >
          🔄 Refresh Logs
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 rounded bg-dark-surface border-dark-border text-dark-accent focus:ring-dark-accent"
          />
          <span className="text-sm text-dark-textMuted">Auto-refresh (5s)</span>
        </label>
        {logs.length > 0 && (
          <span className="text-sm text-dark-textMuted">
            {logs.length} log entries
          </span>
        )}
      </div>

      {/* Logs Container */}
      <div className="bg-dark-bg border border-dark-border rounded-xl overflow-hidden">
        <div className="bg-dark-surface/50 px-4 py-2 border-b border-dark-border">
          <div className="flex items-center gap-2 text-sm text-dark-textMuted">
            <span>📄</span>
            <span>Application Logs</span>
          </div>
        </div>
        <div className="h-[600px] overflow-y-auto p-4 font-mono text-sm">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
              <p className="text-dark-textMuted">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4 opacity-30">📄</div>
              <p className="text-dark-textMuted">No logs found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((line, index) => (
                <div
                  key={index}
                  className={`${formatLogLine(line)} break-words hover:bg-dark-surface/30 px-2 py-1 rounded transition-colors`}
                >
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
