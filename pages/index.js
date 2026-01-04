import { useState, useEffect } from 'react';
import Head from 'next/head';
import UploadTab from '../components/UploadTab';
import FilesTab from '../components/FilesTab';
import LogsTab from '../components/LogsTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState('upload');
  const [stats, setStats] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (data.status === 'healthy') {
        setStats({
          buckets: data.bucketCount,
          responseTime: data.responseTime,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload', icon: '📤', description: 'Upload new files' },
    { id: 'files', label: 'Files', icon: '📋', description: 'Manage your files' },
    { id: 'logs', label: 'Logs', icon: '📄', description: 'View activity logs' },
  ];

  return (
    <>
      <Head>
        <title>Supabase File Manager</title>
        <meta name="description" content="Professional file management for Supabase Storage" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-purple-900/20 to-dark-bg">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-dark-accent/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
          {/* Header */}
          <div className={`text-center mb-6 sm:mb-8 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="text-4xl sm:text-5xl animate-bounce" style={{ animationDuration: '2s' }}>📦</div>
              <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-dark-text via-dark-accent to-purple-400 bg-clip-text text-transparent leading-normal pb-1">
                Supabase File Manager
              </h1>
            </div>
            <p className="text-dark-textMuted text-base sm:text-lg">
              Professional file management for Supabase Storage
            </p>
            {/* Status Badge */}
            {stats && (
              <div className="inline-flex items-center gap-3 mt-4 px-4 py-2 bg-dark-surface/50 border border-dark-border rounded-full text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-green-400">Connected</span>
                </span>
                <span className="w-px h-4 bg-dark-border"></span>
                <span className="text-dark-textMuted">
                  {stats.buckets} bucket{stats.buckets !== 1 ? 's' : ''}
                </span>
                <span className="w-px h-4 bg-dark-border"></span>
                <span className="text-dark-textMuted">
                  {stats.responseTime}ms
                </span>
              </div>
            )}
          </div>

          {/* Main Card */}
          <div className={`bg-dark-surface/80 backdrop-blur-xl border border-dark-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Tabs */}
            <div className="border-b border-dark-border bg-dark-surface/50">
              <div className="flex gap-1 p-1.5 sm:p-2">
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group flex-1 px-3 sm:px-6 py-3 sm:py-4 font-semibold rounded-lg sm:rounded-xl transition-all duration-300 relative overflow-hidden ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-dark-accent to-purple-600 text-white shadow-lg shadow-dark-accent/30'
                        : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover'
                    }`}
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-dark-accent/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <span className="relative flex items-center justify-center gap-2">
                      <span className={`text-lg sm:text-xl transition-transform ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {tab.icon}
                      </span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </span>

                    {/* Active indicator */}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/30 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Description */}
            <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6">
              <div className="flex items-center gap-2 text-sm text-dark-textMuted">
                <span className="text-lg">{tabs.find(t => t.id === activeTab)?.icon}</span>
                <span className="font-medium text-dark-text">{tabs.find(t => t.id === activeTab)?.label}</span>
                <span className="w-1 h-1 rounded-full bg-dark-textMuted"></span>
                <span>{tabs.find(t => t.id === activeTab)?.description}</span>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6 md:p-8 min-h-0 flex flex-col" style={{ minHeight: '500px' }}>
              <div className="flex-1 min-h-0">
                {activeTab === 'upload' && <UploadTab />}
                {activeTab === 'files' && <FilesTab />}
                {activeTab === 'logs' && <LogsTab />}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`text-center mt-6 sm:mt-8 transition-all duration-700 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-dark-surface/30 rounded-full text-dark-textMuted text-sm">
              <span>Built with</span>
              <span className="text-dark-text font-medium">Next.js</span>
              <span>&</span>
              <span className="text-dark-text font-medium">Tailwind CSS</span>
              <span className="w-px h-4 bg-dark-border"></span>
              <span>Powered by</span>
              <span className="text-green-400 font-medium">Supabase</span>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="fixed bottom-4 right-4 hidden lg:block">
          <div className="px-3 py-2 bg-dark-surface/80 backdrop-blur border border-dark-border rounded-lg text-xs text-dark-textMuted">
            <span className="text-dark-text font-medium">Tip:</span> Press <kbd className="px-1.5 py-0.5 bg-dark-bg rounded text-dark-accent">Ctrl+F</kbd> to search
          </div>
        </div>
      </div>
    </>
  );
}
