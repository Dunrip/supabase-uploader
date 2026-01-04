/**
 * Storage Client Factory
 * Creates Supabase clients dynamically using user's own credentials
 */
import { createClient } from '@supabase/supabase-js';
import { verifySession } from './authMiddleware.js';
import { getUserSettingsWithKey } from './userSettings.js';

/**
 * Error thrown when user hasn't configured their Supabase connection
 */
export class StorageNotConfiguredError extends Error {
  constructor(message = 'Supabase storage is not configured. Please configure your Supabase credentials in Settings.') {
    super(message);
    this.name = 'StorageNotConfiguredError';
    this.statusCode = 400;
  }
}

/**
 * Error thrown when authentication is required but not provided
 */
export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
    this.statusCode = 401;
  }
}

/**
 * Create a Supabase storage client using the authenticated user's credentials
 *
 * @param {object} req - Next.js API request (must have user attached via withAuth middleware)
 * @returns {Promise<{client: SupabaseClient, settings: object}>}
 * @throws {AuthenticationRequiredError} If user is not authenticated
 * @throws {StorageNotConfiguredError} If user hasn't configured Supabase credentials
 */
export async function createStorageClient(req) {
  // Check if user is attached to request (via withAuth middleware)
  if (!req.user) {
    // Try to verify session
    const session = await verifySession(req);
    if (!session) {
      throw new AuthenticationRequiredError();
    }
    req.user = session.user;
  }

  const userId = req.user.id;

  // Get user's settings with decrypted key
  const settings = await getUserSettingsWithKey(userId);

  if (!settings?.supabase_url || !settings?.supabase_key) {
    throw new StorageNotConfiguredError();
  }

  // Create Supabase client with user's credentials
  const client = createClient(settings.supabase_url, settings.supabase_key);

  return {
    client,
    settings: {
      supabase_url: settings.supabase_url,
      default_bucket: settings.default_bucket,
      max_retries: settings.max_retries,
    },
  };
}

/**
 * Create a storage client and handle common errors
 * Returns a standardized error response if something goes wrong
 *
 * @param {object} req - Next.js API request
 * @param {object} res - Next.js API response
 * @returns {Promise<{client: SupabaseClient, settings: object} | null>}
 */
export async function createStorageClientWithErrorHandling(req, res) {
  try {
    return await createStorageClient(req);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: 'AUTH_REQUIRED',
      });
      return null;
    }

    if (error instanceof StorageNotConfiguredError) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'STORAGE_NOT_CONFIGURED',
      });
      return null;
    }

    console.error('Storage client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to storage',
    });
    return null;
  }
}

/**
 * Get the default bucket for the user
 *
 * @param {object} req - Next.js API request with user attached
 * @returns {Promise<string>}
 */
export async function getDefaultBucket(req) {
  if (!req.user) {
    return 'files';
  }

  try {
    const settings = await getUserSettingsWithKey(req.user.id);
    return settings?.default_bucket || 'files';
  } catch {
    return 'files';
  }
}

/**
 * Get max retries setting for the user
 *
 * @param {object} req - Next.js API request with user attached
 * @returns {Promise<number>}
 */
export async function getMaxRetries(req) {
  if (!req.user) {
    return 3;
  }

  try {
    const settings = await getUserSettingsWithKey(req.user.id);
    return settings?.max_retries || 3;
  } catch {
    return 3;
  }
}
