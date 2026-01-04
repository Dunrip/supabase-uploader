/**
 * Settings Modal Component
 * Configure Supabase connection and other user preferences
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings, testConnection } = useAuth();

  const [formData, setFormData] = useState({
    supabase_url: '',
    supabase_key: '',
    default_bucket: 'files',
    max_retries: 3,
    theme: 'dark',
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen && settings) {
      setFormData({
        supabase_url: settings.supabase_url || '',
        supabase_key: '', // Don't pre-fill the key for security
        default_bucket: settings.default_bucket || 'files',
        max_retries: settings.max_retries || 3,
        theme: settings.theme || 'dark',
      });
      setError(null);
      setSuccess(null);
      setTestResult(null);
    }
  }, [isOpen, settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_retries' ? parseInt(value) || 0 : value,
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!formData.supabase_url || !formData.supabase_key) {
      setError('URL and API key are required to test connection');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testConnection(formData.supabase_url, formData.supabase_key);
      setTestResult(result);

      if (result.success && result.buckets?.length > 0 && !formData.default_bucket) {
        setFormData(prev => ({
          ...prev,
          default_bucket: result.buckets[0],
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Only include key if it was changed
      const dataToSave = {
        supabase_url: formData.supabase_url,
        default_bucket: formData.default_bucket,
        max_retries: formData.max_retries,
        theme: formData.theme,
      };

      if (formData.supabase_key) {
        dataToSave.supabase_key = formData.supabase_key;
      }

      const { error: saveError } = await updateSettings(dataToSave);

      if (saveError) {
        setError(saveError.message);
      } else {
        setSuccess('Settings saved successfully');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-surface rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-dark-text">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-textMuted hover:text-dark-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Supabase Connection Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-dark-text border-b border-dark-border pb-2">
              Supabase Connection
            </h3>

            <div>
              <label htmlFor="supabase_url" className="block text-sm font-medium text-dark-textMuted mb-1">
                Supabase URL
              </label>
              <input
                id="supabase_url"
                name="supabase_url"
                type="url"
                value={formData.supabase_url}
                onChange={handleChange}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg
                           text-dark-text placeholder:text-dark-textMuted/50
                           focus:outline-none focus:ring-2 focus:ring-dark-accent"
              />
            </div>

            <div>
              <label htmlFor="supabase_key" className="block text-sm font-medium text-dark-textMuted mb-1">
                API Key (Service Role)
                {settings?.supabase_key_hint && (
                  <span className="ml-2 text-xs text-dark-textMuted">
                    Current: {settings.supabase_key_hint}
                  </span>
                )}
              </label>
              <input
                id="supabase_key"
                name="supabase_key"
                type="password"
                value={formData.supabase_key}
                onChange={handleChange}
                placeholder={settings?.has_supabase_configured ? '••••••••' : 'Enter your service role key'}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg
                           text-dark-text placeholder:text-dark-textMuted/50
                           focus:outline-none focus:ring-2 focus:ring-dark-accent"
              />
              <p className="mt-1 text-xs text-dark-textMuted">
                Your API key is encrypted before storage
              </p>
            </div>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !formData.supabase_url || !formData.supabase_key}
              className="w-full py-2 px-4 bg-dark-bg border border-dark-border rounded-lg
                         text-dark-text hover:bg-dark-border transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing...
                </span>
              ) : 'Test Connection'}
            </button>

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {testResult.success ? (
                  <>
                    Connection successful! Found {testResult.buckets?.length || 0} bucket(s):
                    {testResult.buckets?.length > 0 && (
                      <ul className="mt-1 list-disc list-inside">
                        {testResult.buckets.map(b => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  `Connection failed: ${testResult.error}`
                )}
              </div>
            )}
          </div>

          {/* Default Settings Section */}
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-medium text-dark-text border-b border-dark-border pb-2">
              Defaults
            </h3>

            <div>
              <label htmlFor="default_bucket" className="block text-sm font-medium text-dark-textMuted mb-1">
                Default Bucket
              </label>
              <input
                id="default_bucket"
                name="default_bucket"
                type="text"
                value={formData.default_bucket}
                onChange={handleChange}
                placeholder="files"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg
                           text-dark-text placeholder:text-dark-textMuted/50
                           focus:outline-none focus:ring-2 focus:ring-dark-accent"
              />
            </div>

            <div>
              <label htmlFor="max_retries" className="block text-sm font-medium text-dark-textMuted mb-1">
                Max Retries
              </label>
              <input
                id="max_retries"
                name="max_retries"
                type="number"
                min="0"
                max="10"
                value={formData.max_retries}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg
                           text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-dark-bg border border-dark-border rounded-lg
                         text-dark-text hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-dark-accent hover:bg-dark-accent/80
                         text-white font-medium rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
