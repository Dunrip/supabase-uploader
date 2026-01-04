/**
 * Auth Supabase Client
 * Connects to the central Supabase project for authentication and user settings
 */
import { createClient } from '@supabase/supabase-js';

let browserClient = null;
let serverClient = null;

/**
 * Get the browser-side auth client (uses anon key)
 * This client is used for:
 * - User authentication (login, register, logout)
 * - Session management
 * - Reading user settings (with RLS)
 *
 * @returns {SupabaseClient}
 */
export function getAuthClientBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('getAuthClientBrowser should only be called on the client side');
  }

  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing auth configuration. Please set NEXT_PUBLIC_AUTH_SUPABASE_URL and NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY'
    );
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return browserClient;
}

/**
 * Get the server-side auth client (uses service role key)
 * This client is used for:
 * - Verifying session tokens
 * - Reading/writing user settings with elevated privileges
 * - Admin operations
 *
 * @returns {SupabaseClient}
 */
export function getAuthClientServer() {
  if (typeof window !== 'undefined') {
    throw new Error('getAuthClientServer should only be called on the server side');
  }

  if (serverClient) {
    return serverClient;
  }

  const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || process.env.AUTH_SUPABASE_URL;
  const serviceKey = process.env.AUTH_SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing auth configuration. Please set AUTH_SUPABASE_URL and AUTH_SUPABASE_SERVICE_KEY'
    );
  }

  serverClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClient;
}

/**
 * Create a server-side client with a user's access token
 * Used to make requests on behalf of the authenticated user
 *
 * @param {string} accessToken - User's JWT access token
 * @returns {SupabaseClient}
 */
export function getAuthClientWithToken(accessToken) {
  if (typeof window !== 'undefined') {
    throw new Error('getAuthClientWithToken should only be called on the server side');
  }

  const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || process.env.AUTH_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || process.env.AUTH_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing auth configuration');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Extract session from request cookies or authorization header
 *
 * @param {Request} req - The incoming request
 * @returns {Promise<{user: object, session: object} | null>}
 */
export async function getSessionFromRequest(req) {
  const authClient = getAuthClientServer();

  // Try to get token from Authorization header first
  const authHeader = req.headers.authorization || req.headers.get?.('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (!error && user) {
      return { user, accessToken: token };
    }
  }

  // Try to get from cookies
  const cookies = req.cookies || {};
  const accessToken = cookies['sb-access-token'] || cookies.get?.('sb-access-token')?.value;

  if (accessToken) {
    const { data: { user }, error } = await authClient.auth.getUser(accessToken);

    if (!error && user) {
      return { user, accessToken };
    }
  }

  return null;
}

/**
 * Verify that a user is authenticated
 *
 * @param {Request} req - The incoming request
 * @returns {Promise<{authenticated: boolean, user?: object, error?: string}>}
 */
export async function verifyAuth(req) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return { authenticated: false, error: 'No valid session found' };
    }

    return { authenticated: true, user: session.user, accessToken: session.accessToken };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
}

/**
 * Check if auth is configured
 * @returns {boolean}
 */
export function isAuthConfigured() {
  const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;
  return Boolean(url && anonKey);
}
