/**
 * User Settings Management
 * CRUD operations for user settings stored in the central Supabase database
 */
import { createClient } from '@supabase/supabase-js';
import { getAuthClientServer } from './authSupabaseClient.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.js';

/**
 * Default settings for new users
 */
const DEFAULT_SETTINGS = {
  supabase_url: null,
  supabase_key_encrypted: null,
  default_bucket: 'files',
  max_retries: 3,
  theme: 'dark',
};

/**
 * Get user settings from the database
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<object|null>} User settings or null if not found
 */
export async function getUserSettings(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const supabase = getAuthClientServer();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found, return defaults
      return { ...DEFAULT_SETTINGS, user_id: userId };
    }
    throw error;
  }

  return data;
}

/**
 * Get user settings with decrypted API key (for server-side use only)
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<object|null>} Settings with decrypted key
 */
export async function getUserSettingsWithKey(userId) {
  const settings = await getUserSettings(userId);

  if (!settings) {
    return null;
  }

  // Decrypt the API key if present
  if (settings.supabase_key_encrypted) {
    try {
      settings.supabase_key = decryptApiKey(settings.supabase_key_encrypted);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      settings.supabase_key = null;
    }
  } else {
    settings.supabase_key = null;
  }

  return settings;
}

/**
 * Get user settings safe for client (masks API key)
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<object|null>} Settings with masked key
 */
export async function getUserSettingsForClient(userId) {
  const settings = await getUserSettingsWithKey(userId);

  if (!settings) {
    return null;
  }

  // Return a client-safe version
  return {
    id: settings.id,
    user_id: settings.user_id,
    supabase_url: settings.supabase_url,
    supabase_key_hint: settings.supabase_key ? maskApiKey(settings.supabase_key) : null,
    has_supabase_configured: Boolean(settings.supabase_url && settings.supabase_key),
    default_bucket: settings.default_bucket,
    max_retries: settings.max_retries,
    theme: settings.theme,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  };
}

/**
 * Save user settings to the database
 *
 * @param {string} userId - The user's UUID
 * @param {object} settings - Settings to save
 * @returns {Promise<object>} Updated settings
 */
export async function saveUserSettings(userId, settings) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const supabase = getAuthClientServer();

  // Prepare the data for storage
  const dataToSave = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  // Handle Supabase URL
  if (settings.supabase_url !== undefined) {
    dataToSave.supabase_url = settings.supabase_url || null;
  }

  // Handle API key - encrypt before storing
  if (settings.supabase_key !== undefined) {
    if (settings.supabase_key) {
      dataToSave.supabase_key_encrypted = encryptApiKey(settings.supabase_key);
    } else {
      dataToSave.supabase_key_encrypted = null;
    }
  }

  // Handle other settings
  if (settings.default_bucket !== undefined) {
    dataToSave.default_bucket = settings.default_bucket || 'files';
  }

  if (settings.max_retries !== undefined) {
    dataToSave.max_retries = parseInt(settings.max_retries) || 3;
  }

  if (settings.theme !== undefined) {
    dataToSave.theme = settings.theme || 'dark';
  }

  // Upsert the settings
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(dataToSave, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Delete user settings from the database
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<void>}
 */
export async function deleteUserSettings(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const supabase = getAuthClientServer();

  const { error } = await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Validate Supabase credentials by attempting to connect
 *
 * @param {string} url - Supabase project URL
 * @param {string} key - Supabase API key
 * @returns {Promise<{valid: boolean, error?: string, buckets?: string[]}>}
 */
export async function validateSupabaseCredentials(url, key) {
  if (!url || !key) {
    return { valid: false, error: 'URL and API key are required' };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Try to connect and list buckets
  try {
    const testClient = createClient(url, key);
    const { data, error } = await testClient.storage.listBuckets();

    if (error) {
      return { valid: false, error: error.message };
    }

    return {
      valid: true,
      buckets: data.map(b => b.name),
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Check if user has configured their Supabase connection
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<boolean>}
 */
export async function hasSupabaseConfigured(userId) {
  const settings = await getUserSettings(userId);
  return Boolean(settings?.supabase_url && settings?.supabase_key_encrypted);
}
