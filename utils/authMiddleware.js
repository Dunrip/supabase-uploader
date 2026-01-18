/**
 * Authentication middleware for API routes
 * Verifies user session before allowing access to protected endpoints
 * Includes CSRF protection for state-changing operations
 */
import { getAuthClientServer } from './authSupabaseClient.js';
import { sendError } from './apiHelpers.js';
import { validateCsrfRequest, getCsrfSecret, CSRF_CONFIG } from './csrf.js';

/**
 * Extract access token from request
 * Checks Authorization header and cookies
 *
 * @param {object} req - Next.js API request
 * @returns {string|null} Access token or null
 */
function extractAccessToken(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter (for browser-initiated requests like image loading)
  // This is used when the browser loads images/videos directly without fetch
  if (req.query?.token) {
    return req.query.token;
  }

  // Check cookies
  const cookies = req.cookies || {};

  // Supabase auth cookie names
  const cookieNames = [
    'sb-access-token',
    'supabase-auth-token',
  ];

  for (const name of cookieNames) {
    if (cookies[name]) {
      // Parse if it's a JSON string (Supabase stores tokens as JSON)
      try {
        const parsed = JSON.parse(cookies[name]);
        if (parsed.access_token) {
          return parsed.access_token;
        }
        if (Array.isArray(parsed) && parsed[0]) {
          return parsed[0];
        }
      } catch {
        // Not JSON, use as-is
        return cookies[name];
      }
    }
  }

  return null;
}

/**
 * Verify a user's session and return user info
 *
 * @param {object} req - Next.js API request
 * @returns {Promise<{user: object, accessToken: string} | null>}
 */
export async function verifySession(req) {
  const accessToken = extractAccessToken(req);

  if (!accessToken) {
    return null;
  }

  try {
    const authClient = getAuthClientServer();
    const { data: { user }, error } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
      return null;
    }

    return { user, accessToken };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

/**
 * Validate CSRF token for state-changing requests
 * @param {object} req - Next.js API request
 * @param {object} res - Next.js API response
 * @param {boolean} skipCsrf - Whether to skip CSRF validation
 * @returns {boolean} True if valid or skipped, false if invalid
 */
function validateCsrf(req, res, skipCsrf = false) {
  if (skipCsrf) {
    return true;
  }

  // Only validate for state-changing methods
  const method = req.method?.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true;
  }

  try {
    const secret = getCsrfSecret();
    const validation = validateCsrfRequest(req, secret);

    if (!validation.valid) {
      sendError(res, validation.error || 'CSRF validation failed', 403);
      return false;
    }

    return true;
  } catch (error) {
    // If CSRF_SECRET/ENCRYPTION_KEY is not configured, log warning but allow request
    // This provides backward compatibility during migration
    console.warn('[Auth] CSRF validation skipped:', error.message);
    return true;
  }
}

/**
 * Higher-order function that wraps an API handler with authentication
 *
 * @param {function} handler - The API route handler
 * @param {object} options - Options
 * @param {boolean} options.optional - If true, don't require auth but attach user if present
 * @param {boolean} options.skipCsrf - If true, skip CSRF validation (use with caution)
 * @returns {function} Wrapped handler
 *
 * @example
 * // Required auth with CSRF protection
 * export default withAuth(async (req, res) => {
 *   const { user } = req;
 *   // user is guaranteed to exist
 * });
 *
 * // Optional auth
 * export default withAuth(async (req, res) => {
 *   const { user } = req; // may be undefined
 * }, { optional: true });
 *
 * // Skip CSRF (for file uploads with multipart/form-data)
 * export default withAuth(handler, { skipCsrf: true });
 */
export function withAuth(handler, options = {}) {
  const { optional = false, skipCsrf = false } = options;

  return async (req, res) => {
    try {
      const session = await verifySession(req);

      if (!session && !optional) {
        return sendError(res, 'Authentication required', 401);
      }

      // Attach user and accessToken to request
      if (session) {
        req.user = session.user;
        req.accessToken = session.accessToken;
      }

      // Validate CSRF for state-changing operations
      // Only validate if user is authenticated (no point validating for unauthenticated requests)
      if (session && !validateCsrf(req, res, skipCsrf)) {
        return; // Response already sent by validateCsrf
      }

      // Call the original handler
      return handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return sendError(res, 'Authentication error', 500);
    }
  };
}

/**
 * Higher-order function that adds only CSRF protection (no auth required)
 * Use this for public endpoints that still need CSRF protection
 *
 * @param {function} handler - The API route handler
 * @returns {function} Wrapped handler
 */
export function withCsrf(handler) {
  return async (req, res) => {
    try {
      if (!validateCsrf(req, res, false)) {
        return; // Response already sent
      }
      return handler(req, res);
    } catch (error) {
      console.error('CSRF middleware error:', error);
      return sendError(res, 'CSRF validation error', 500);
    }
  };
}

/**
 * Check if a request is authenticated without blocking
 * Useful for endpoints that behave differently for authenticated users
 *
 * @param {object} req - Next.js API request
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(req) {
  const session = await verifySession(req);
  return session !== null;
}

/**
 * Get user ID from request (assumes withAuth middleware has run)
 *
 * @param {object} req - Next.js API request
 * @returns {string|null}
 */
export function getUserId(req) {
  return req.user?.id || null;
}

/**
 * Get user email from request (assumes withAuth middleware has run)
 *
 * @param {object} req - Next.js API request
 * @returns {string|null}
 */
export function getUserEmail(req) {
  return req.user?.email || null;
}
