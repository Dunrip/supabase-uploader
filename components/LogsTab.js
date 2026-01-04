import { useState, useEffect, useRef, useMemo } from 'react';

export default function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadLogs();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

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
    if (line.includes('[WARN]') || line.includes('[WARNING]')) return 'warning';
    return 'default';
  };

  const getLogLevelStyle = (level) => {
    const styles = {
      error: 'text-red-400 bg-red-500/5',
      success: 'text-green-400 bg-green-500/5',
      info: 'text-blue-400 bg-blue-500/5',
      warning: 'text-yellow-400 bg-yellow-500/5',
      default: 'text-dark-textMuted',
    };
    return styles[level] || styles.default;
  };

  const getLogLevelBadge = (level) => {
    const badges = {
      error: { emoji: '❌', bg: 'bg-red-500/20 text-red-400' },
      success: { emoji: '✅', bg: 'bg-green-500/20 text-green-400' },
      info: { emoji: 'ℹ️', bg: 'bg-blue-500/20 text-blue-400' },
      warning: { emoji: '⚠️', bg: 'bg-yellow-500/20 text-yellow-400' },
      default: { emoji: '📄', bg: 'bg-dark-border text-dark-textMuted' },
    };
    return badges[level] || badges.default;
  };

  // Filter logs based on search and level
  const filteredLogs = useMemo(() => {
    return logs.filter(line => {
      const matchesSearch = searchQuery === '' ||
        line.toLowerCase().includes(searchQuery.toLowerCase());
      const level = getLogLevel(line);
      const matchesLevel = filterLevel === 'all' || level === filterLevel;
      return matchesSearch && matchesLevel;
    });
  }, [logs, searchQuery, filterLevel]);

  // Count logs by level
  const logCounts = useMemo(() => {
    const counts = { error: 0, success: 0, info: 0, warning: 0, default: 0 };
    logs.forEach(line => {
      const level = getLogLevel(line);
      counts[level]++;
    });
    return counts;
  }, [logs]);

  const copyToClipboard = async () => {
    const text = filteredLogs.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const scrollToTop = () => {
    logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-full">
      {/* Stats Bar */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-surface/50 border border-dark-border rounded-lg text-sm">
            <span className="text-dark-textMuted">Total:</span>
            <span className="font-medium text-dark-text">{logs.length}</span>
          </div>
          {logCounts.error > 0 && (
            <button
              onClick={() => setFilterLevel(filterLevel === 'error' ? 'all' : 'error')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterLevel === 'error' ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500/50' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              }`}
            >
              ❌ {logCounts.error} errors
            </button>
          )}
          {logCounts.success > 0 && (
            <button
              onClick={() => setFilterLevel(filterLevel === 'success' ? 'all' : 'success')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterLevel === 'success' ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500/50' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              ✅ {logCounts.success} success
            </button>
          )}
          {logCounts.info > 0 && (
            <button
              onClick={() => setFilterLevel(filterLevel === 'info' ? 'all' : 'info')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterLevel === 'info' ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              ℹ️ {logCounts.info} info
            </button>
          )}
          {filterLevel !== 'all' && (
            <button
              onClick={() => setFilterLevel('all')}
              className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text text-sm transition-all"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent text-sm"
          />
          <span className="absolute left-3 top-2.5 text-dark-textMuted text-sm">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-dark-textMuted hover:text-dark-text text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all text-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={copyToClipboard}
            disabled={filteredLogs.length === 0}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all text-sm disabled:opacity-50 flex items-center gap-1.5"
            title="Copy logs to clipboard"
          >
            📋
            <span className="hidden sm:inline">Copy</span>
          </button>

          <div className="w-px h-6 bg-dark-border hidden sm:block"></div>

          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-dark-surface border border-dark-border rounded-lg hover:bg-dark-surfaceHover transition-all">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded bg-dark-bg border-dark-border text-dark-accent focus:ring-dark-accent focus:ring-offset-0"
            />
            <span className="text-sm text-dark-textMuted whitespace-nowrap">
              Auto-refresh {autoRefresh && <span className="text-dark-accent">(5s)</span>}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-dark-surface border border-dark-border rounded-lg hover:bg-dark-surfaceHover transition-all">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-4 h-4 rounded bg-dark-bg border-dark-border text-dark-accent focus:ring-dark-accent focus:ring-offset-0"
            />
            <span className="text-sm text-dark-textMuted whitespace-nowrap">Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Logs Container */}
      <div className="bg-dark-bg border border-dark-border rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="bg-dark-surface/50 px-4 py-2 border-b border-dark-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-dark-textMuted">
            <span>📄</span>
            <span>Application Logs</span>
            {filteredLogs.length !== logs.length && (
              <span className="px-2 py-0.5 bg-dark-accent/20 text-dark-accent rounded text-xs">
                {filteredLogs.length} of {logs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={scrollToTop}
              className="p-1.5 text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover rounded transition-all"
              title="Scroll to top"
            >
              ⬆️
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1.5 text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover rounded transition-all"
              title="Scroll to bottom"
            >
              ⬇️
            </button>
          </div>
        </div>

        <div
          ref={logsContainerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        >
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
              <p className="text-dark-textMuted">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4 opacity-30">{searchQuery || filterLevel !== 'all' ? '🔍' : '📄'}</div>
              <p className="text-dark-textMuted text-lg mb-2">
                {searchQuery || filterLevel !== 'all' ? 'No logs match your filters' : 'No logs found'}
              </p>
              {(searchQuery || filterLevel !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterLevel('all');
                  }}
                  className="mt-4 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:border-dark-accent/50 transition-all text-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((line, index) => {
                const level = getLogLevel(line);
                const badge = getLogLevelBadge(level);
                return (
                  <div
                    key={index}
                    className={`${getLogLevelStyle(level)} break-words px-3 py-2 rounded-lg transition-colors hover:ring-1 hover:ring-dark-border group`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        {badge.emoji}
                      </span>
                      <span className="flex-1">{line}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
