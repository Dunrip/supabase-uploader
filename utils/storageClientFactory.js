/**
 * Storage Client Factory
 * Creates Supabase clients dynamically using user's own credentials
 * Includes LRU cache with TTL to reduce client creation overhead
 */
import { createClient } from '@supabase/supabase-js';
import { verifySession } from './authMiddleware.js';
import { getUserSettingsWithKey } from './userSettings.js';

/**
 * LRU Cache Configuration
 */
const CLIENT_CACHE_MAX_SIZE = 100;  // Maximum number of cached clients
const CLIENT_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes TTL

/**
 * Simple LRU Cache implementation for Supabase clients
 * Includes TTL (time-to-live) for automatic expiration
 */
class LRUClientCache {
  constructor(maxSize = CLIENT_CACHE_MAX_SIZE, ttl = CLIENT_CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.accessOrder = [];  // Most recent access at the end
  }

  /**
   * Generate cache key from user ID and credentials hash
   * @param {string} userId - User ID
   * @param {string} supabaseUrl - Supabase URL
   * @returns {string} Cache key
   */
  generateKey(userId, supabaseUrl) {
    // Key by user ID and URL to handle credential changes
    return `${userId}:${supabaseUrl}`;
  }

  /**
   * Get a cached client
   * @param {string} key - Cache key
   * @returns {SupabaseClient|null} Cached client or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check TTL expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    // Update access order (move to end)
    this.updateAccessOrder(key);
    return entry.client;
  }

  /**
   * Store a client in cache
   * @param {string} key - Cache key
   * @param {SupabaseClient} client - Supabase client to cache
   * @param {object} settings - User settings (for validation on retrieval)
   */
  set(key, client, settings) {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      client,
      settings,
      timestamp: Date.now(),
    });

    this.updateAccessOrder(key);
  }

  /**
   * Delete a cached client
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Invalidate cache for a specific user
   * Used when user updates their credentials
   * @param {string} userId - User ID to invalidate
   */
  invalidateUser(userId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Update access order for LRU tracking
   * @param {string} key - Cache key
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict the least recently used entry
   */
  evictOldest() {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   * Called periodically to free memory
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Get cache statistics for monitoring
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttl,
    };
  }
}

// Global client cache instance
const clientCache = new LRUClientCache();

// Periodic cleanup every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    clientCache.cleanup();
  }, 2 * 60 * 1000);
}

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
 * Invalidate cached client for a user
 * Call this when user updates their Supabase credentials
 * @param {string} userId - User ID whose cache should be invalidated
 */
export function invalidateClientCache(userId) {
  clientCache.invalidateUser(userId);
}

/**
 * Get cache statistics for monitoring/debugging
 * @returns {object} Cache stats
 */
export function getClientCacheStats() {
  return clientCache.getStats();
}

/**
 * Create a Supabase storage client using the authenticated user's credentials
 * Uses LRU cache with TTL to reduce overhead of creating new clients
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

  // Generate cache key
  const cacheKey = clientCache.generateKey(userId, settings.supabase_url);

  // Try to get cached client
  const cachedClient = clientCache.get(cacheKey);
  if (cachedClient) {
    return {
      client: cachedClient,
      settings: {
        supabase_url: settings.supabase_url,
        default_bucket: settings.default_bucket,
        max_retries: settings.max_retries,
      },
    };
  }

  // Create new Supabase client with user's credentials
  const client = createClient(settings.supabase_url, settings.supabase_key);

  // Cache the client for future requests
  clientCache.set(cacheKey, client, {
    supabase_url: settings.supabase_url,
  });

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
