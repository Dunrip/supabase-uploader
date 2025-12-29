import { useState } from 'react';
import Head from 'next/head';
import UploadTab from '../components/UploadTab';
import FilesTab from '../components/FilesTab';
import LogsTab from '../components/LogsTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState('upload');

  const tabs = [
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'files', label: 'Files', icon: '📋' },
    { id: 'logs', label: 'Logs', icon: '📄' },
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
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-1">
              <div className="text-5xl animate-bounce" style={{ animationDuration: '2s' }}>📦</div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-dark-text via-dark-accent to-purple-400 bg-clip-text text-transparent leading-normal pb-2">
                Supabase File Manager
              </h1>
            </div>
            <p className="text-dark-textMuted text-lg">
              Professional file management for Supabase Storage
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-dark-surface/80 backdrop-blur-xl border border-dark-border rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Tabs */}
            <div className="border-b border-dark-border bg-dark-surface/50">
              <div className="flex gap-1 p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-6 py-4 font-semibold rounded-xl transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-dark-accent to-purple-600 text-white shadow-lg shadow-dark-accent/30 transform scale-105'
                        : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover'
                    }`}
                  >
                    <span className="text-xl mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 md:p-8 min-h-0 flex flex-col" style={{ minHeight: '400px' }}>
              {activeTab === 'upload' && <UploadTab />}
              {activeTab === 'files' && <FilesTab />}
              {activeTab === 'logs' && <LogsTab />}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-dark-textMuted text-sm animate-fade-in">
            <p>Built with Next.js & Tailwind CSS • Powered by Supabase</p>
          </div>
        </div>
      </div>
    </>
  );
}
