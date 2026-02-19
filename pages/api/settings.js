/**
 * User Settings API Endpoint
 * GET - Fetch user settings
 * POST - Save user settings
 */
import { withAuth, getUserId } from '../../utils/authMiddleware.js';
import { getUserSettingsForClient, saveUserSettings } from '../../utils/userSettings.js';
import { sendSuccess, sendError, validateMethod } from '../../utils/apiHelpers.js';
import { invalidateClientCache } from '../../utils/storageClientFactory.js';
import { enforceRole } from '../../utils/rbac.js';

async function handler(req, res) {
  if (!validateMethod(req, res, ['GET', 'POST'])) return;

  const userId = getUserId(req);

  if (!userId) {
    return sendError(res, 'User not found', 400);
  }

  try {
    if (req.method === 'GET') {
      // Fetch user settings
      const settings = await getUserSettingsForClient(userId);
      return sendSuccess(res, { settings });
    }

    if (req.method === 'POST') {
      if (!enforceRole(req, res, 'admin')) return;
      // Save user settings
      const { supabase_url, supabase_key, default_bucket, max_retries, theme } = req.body;

      const settings = await saveUserSettings(userId, {
        supabase_url,
        supabase_key,
        default_bucket,
        max_retries,
        theme,
      });

      // Invalidate cached Supabase client when credentials are updated
      // This ensures the new credentials are used on the next request
      if (supabase_url || supabase_key) {
        invalidateClientCache(userId);
      }

      // Return client-safe version
      const clientSettings = await getUserSettingsForClient(userId);
      return sendSuccess(res, { settings: clientSettings });
    }
  } catch (error) {
    console.error('Settings API error:', error);
    return sendError(res, error.message || 'Failed to process settings', 500);
  }
}

export default withAuth(handler);
