import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import UploadTab from '../components/UploadTab';
import FilesTab from '../components/FilesTab';
import LogsTab from '../components/LogsTab';
import SettingsModal from '../components/SettingsModal';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, settings, loading, settingsLoading, isConfigured, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState('upload');
  const [stats, setStats] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && isConfigured) {
      setIsLoaded(true);
      loadStats();
    } else if (user) {
      setIsLoaded(true);
    }
  }, [user, isConfigured]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

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

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-dark-accent"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

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
          {/* User Controls Bar */}
          <div className={`flex items-center justify-between mb-4 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="flex items-center gap-2 text-sm text-dark-textMuted">
              <span className="w-8 h-8 rounded-full bg-dark-accent/20 flex items-center justify-center text-dark-accent font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-dark-textMuted hover:text-dark-text hover:bg-dark-surface/50 rounded-lg transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-dark-textMuted hover:text-red-400 hover:bg-dark-surface/50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

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
            {isConfigured && stats && (
              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 px-3 sm:px-4 py-2 bg-dark-surface/50 border border-dark-border rounded-full text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-green-400">Connected</span>
                </span>
                <span className="w-px h-4 bg-dark-border hidden sm:block"></span>
                <span className="text-dark-textMuted">
                  {stats.buckets} bucket{stats.buckets !== 1 ? 's' : ''}
                </span>
                <span className="w-px h-4 bg-dark-border hidden sm:block"></span>
                <span className="text-dark-textMuted">
                  {stats.responseTime}ms
                </span>
              </div>
            )}
            {/* Setup Required Banner - only show after settings have loaded */}
            {!settingsLoading && !isConfigured && (
              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 px-3 sm:px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-yellow-400">Setup Required</span>
                </span>
                <span className="w-px h-4 bg-yellow-500/30 hidden sm:block"></span>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  Configure
                </button>
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
                    className={`group flex-1 px-2 sm:px-6 py-3 sm:py-4 font-semibold rounded-lg sm:rounded-xl transition-all duration-300 relative overflow-hidden min-h-[48px] ${activeTab === tab.id
                      ? 'bg-gradient-to-r from-dark-accent to-purple-600 text-white shadow-lg shadow-dark-accent/30'
                      : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover'
                      }`}
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-dark-accent/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <span className="relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2">
                      <span className={`text-lg sm:text-xl transition-transform ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {tab.icon}
                      </span>
                      <span className="text-[10px] sm:text-base">{tab.label}</span>
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
                {settingsLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-dark-accent mb-4"></div>
                    <p className="text-dark-textMuted">Loading settings...</p>
                  </div>
                ) : !isConfigured ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="text-6xl mb-4">🔧</div>
                    <h3 className="text-xl font-semibold text-dark-text mb-2">Setup Required</h3>
                    <p className="text-dark-textMuted mb-6 max-w-md">
                      Configure your Supabase project to start managing files.
                      You&apos;ll need your project URL and service role key.
                    </p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="px-6 py-3 bg-dark-accent hover:bg-dark-accent/80 text-white font-medium rounded-lg transition-colors"
                    >
                      Configure Supabase
                    </button>
                  </div>
                ) : (
                  <>
                    {activeTab === 'upload' && <UploadTab />}
                    {activeTab === 'files' && <FilesTab />}
                    {activeTab === 'logs' && <LogsTab />}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`text-center mt-6 sm:mt-8 transition-all duration-700 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-dark-surface/30 rounded-full text-dark-textMuted text-xs sm:text-sm">
              <span>Built with</span>
              <span className="text-dark-text font-medium">Next.js</span>
              <span className="hidden sm:inline">&</span>
              <span className="text-dark-text font-medium hidden sm:inline">Tailwind</span>
              <span className="w-px h-4 bg-dark-border hidden sm:block"></span>
              <span className="hidden sm:inline">Powered by</span>
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

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
