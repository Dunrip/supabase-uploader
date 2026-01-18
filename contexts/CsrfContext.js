/**
 * CSRF Context
 * Provides CSRF token management throughout the application
 * Automatically fetches and refreshes CSRF tokens
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const CsrfContext = createContext(null);

// CSRF token refresh configuration
const CSRF_REFRESH_INTERVAL = 20 * 60 * 1000; // Refresh every 20 minutes (token expires in 24h)

/**
 * CSRF Provider Component
 * Wrap your app with this to provide CSRF token context
 */
export function CsrfProvider({ children }) {
  const [csrfToken, setCsrfToken] = useState(null);
  const [csrfHeaderName, setCsrfHeaderName] = useState('x-csrf-token');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch a new CSRF token from the server
   */
  const fetchCsrfToken = useCallback(async () => {
    try {
      const response = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }

      const data = await response.json();

      if (data.success && data.token) {
        setCsrfToken(data.token);
        if (data.headerName) {
          setCsrfHeaderName(data.headerName);
        }
        setError(null);
        return data.token;
      } else {
        throw new Error(data.error || 'Invalid CSRF response');
      }
    } catch (err) {
      console.error('[CSRF] Failed to fetch token:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get CSRF headers for fetch requests
   * @returns {object} Headers object with CSRF token
   */
  const getCsrfHeaders = useCallback(() => {
    if (!csrfToken) {
      return {};
    }
    return {
      [csrfHeaderName]: csrfToken,
    };
  }, [csrfToken, csrfHeaderName]);

  /**
   * Helper for making fetch requests with CSRF token
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @returns {Promise<Response>}
   */
  const csrfFetch = useCallback(async (url, options = {}) => {
    // Ensure we have a token for state-changing requests
    const method = options.method?.toUpperCase() || 'GET';
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    let token = csrfToken;

    // If no token and we need one, try to fetch it
    if (!token && isStateChanging) {
      token = await fetchCsrfToken();
    }

    const headers = {
      ...options.headers,
      ...(token ? { [csrfHeaderName]: token } : {}),
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always include cookies for CSRF
    });
  }, [csrfToken, csrfHeaderName, fetchCsrfToken]);

  // Fetch initial CSRF token on mount
  useEffect(() => {
    fetchCsrfToken();
  }, [fetchCsrfToken]);

  // Set up periodic token refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchCsrfToken();
    }, CSRF_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchCsrfToken]);

  const value = {
    csrfToken,
    csrfHeaderName,
    loading,
    error,
    refreshToken: fetchCsrfToken,
    getCsrfHeaders,
    csrfFetch,
  };

  return (
    <CsrfContext.Provider value={value}>
      {children}
    </CsrfContext.Provider>
  );
}

/**
 * Hook to access CSRF context
 * @returns {object} CSRF context value
 */
export function useCsrf() {
  const context = useContext(CsrfContext);

  if (context === null) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }

  return context;
}

export default CsrfContext;
