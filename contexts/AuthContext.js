/**
 * Authentication Context
 * Provides auth state and functions throughout the application
 * Includes proactive session refresh to prevent expired token issues
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext(null);

// Session refresh configuration
const SESSION_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every minute

/**
 * Get the browser-side Supabase auth client
 */
function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('Auth not configured: Missing NEXT_PUBLIC_AUTH_SUPABASE_URL or NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Auth Provider Component
 * Wrap your app with this to provide auth context
 */
export function AuthProvider({ children }) {
  const [supabase] = useState(() => getAuthClient());
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true); // Track settings loading separately
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);
  const isRefreshingRef = useRef(false);

  // Helper to get current access token
  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, [supabase]);

  // Helper for authenticated API calls
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getAccessToken]);

  // Fetch user settings from API
  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setSettingsLoading(false);
      return;
    }

    setSettingsLoading(true);
    try {
      const response = await authFetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [user, authFetch]);

  // Initialize auth state
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setSettings(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  // Fetch settings when user changes
  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  /**
   * Check if session is about to expire and refresh proactively
   * This prevents failed API requests due to expired tokens
   */
  const checkAndRefreshSession = useCallback(async () => {
    if (!supabase || !session || isRefreshingRef.current) {
      return;
    }

    try {
      // Get session expiry time from the JWT
      const expiresAt = session.expires_at;
      if (!expiresAt) {
        return;
      }

      // expiresAt is in seconds (Unix timestamp), convert to milliseconds
      const expiresAtMs = expiresAt * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAtMs - now;

      // If session expires within the threshold, refresh proactively
      if (timeUntilExpiry <= SESSION_REFRESH_THRESHOLD && timeUntilExpiry > 0) {
        console.log(`[Auth] Session expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing proactively...`);

        isRefreshingRef.current = true;

        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('[Auth] Proactive session refresh failed:', refreshError.message);
          // Don't sign out - let the autoRefreshToken handle it or next request will fail
        } else if (data?.session) {
          console.log('[Auth] Session refreshed successfully');
          setSession(data.session);
          setUser(data.session.user);
        }

        isRefreshingRef.current = false;
      }
    } catch (err) {
      console.error('[Auth] Error checking session expiry:', err);
      isRefreshingRef.current = false;
    }
  }, [supabase, session]);

  // Set up proactive session refresh interval
  useEffect(() => {
    if (!supabase || !session) {
      // Clear interval if no session
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Check immediately
    checkAndRefreshSession();

    // Set up interval for periodic checks
    refreshIntervalRef.current = setInterval(checkAndRefreshSession, SESSION_CHECK_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [supabase, session, checkAndRefreshSession]);

  /**
   * Sign in with email and password
   */
  const signIn = async (email, password) => {
    if (!supabase) {
      return { error: { message: 'Auth not configured' } };
    }

    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data };
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email, password) => {
    if (!supabase) {
      return { error: { message: 'Auth not configured' } };
    }

    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data };
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    if (!supabase) {
      return { error: { message: 'Auth not configured' } };
    }

    setError(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return { error };
    }

    setUser(null);
    setSession(null);
    setSettings(null);
    return {};
  };

  /**
   * Update user settings
   */
  const updateSettings = async (newSettings) => {
    if (!user) {
      return { error: { message: 'Not authenticated' } };
    }

    try {
      const response = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      const data = await response.json();

      if (!data.success) {
        return { error: { message: data.error } };
      }

      // Refresh settings
      await fetchSettings();
      return { data: data.settings };
    } catch (err) {
      return { error: { message: err.message } };
    }
  };

  /**
   * Test Supabase connection
   */
  const testConnection = async (url, apiKey) => {
    try {
      const response = await authFetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_url: url, supabase_key: apiKey }),
      });

      return await response.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    // State
    user,
    session,
    settings,
    settingsLoading, // Whether settings are still being fetched
    loading,
    error,
    isAuthenticated: !!user,
    isConfigured: settings?.has_supabase_configured ?? false,

    // Actions
    signIn,
    signUp,
    signOut,
    updateSettings,
    testConnection,
    refreshSettings: fetchSettings,
    authFetch, // Authenticated fetch for API calls
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * @returns {object} Auth context value
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectUrl = '/login') {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user && typeof window !== 'undefined') {
      window.location.href = redirectUrl;
    }
  }, [user, loading, redirectUrl]);

  return { user, loading };
}

export default AuthContext;
