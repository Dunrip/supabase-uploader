/**
 * useSecureFetch Hook
 * Combines authentication and CSRF protection for API calls
 * Use this hook for making secure API requests with both auth and CSRF tokens
 */
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCsrf } from '../contexts/CsrfContext';

/**
 * Hook for making secure API calls with auth and CSRF tokens
 * @returns {object} Object containing secureFetch function
 */
export function useSecureFetch() {
  const { session } = useAuth();
  const { csrfToken, csrfHeaderName, refreshToken } = useCsrf();

  /**
   * Make a secure fetch request with auth and CSRF headers
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @returns {Promise<Response>}
   */
  const secureFetch = useCallback(async (url, options = {}) => {
    const method = options.method?.toUpperCase() || 'GET';
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    // Get current CSRF token, refresh if needed for state-changing requests
    let currentCsrfToken = csrfToken;
    if (!currentCsrfToken && isStateChanging) {
      currentCsrfToken = await refreshToken();
    }

    const headers = {
      ...options.headers,
    };

    // Add Authorization header if we have a session
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    // Add CSRF header for state-changing requests
    if (currentCsrfToken && isStateChanging) {
      headers[csrfHeaderName] = currentCsrfToken;
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always include cookies for CSRF
    });
  }, [session, csrfToken, csrfHeaderName, refreshToken]);

  /**
   * Helper for JSON requests with auth and CSRF
   * @param {string} url - Request URL
   * @param {object} data - Data to send as JSON
   * @param {string} method - HTTP method (default: POST)
   * @returns {Promise<object>} Parsed JSON response
   */
  const secureJson = useCallback(async (url, data, method = 'POST') => {
    const response = await secureFetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  }, [secureFetch]);

  return {
    secureFetch,
    secureJson,
  };
}

export default useSecureFetch;
