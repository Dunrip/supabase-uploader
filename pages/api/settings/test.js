/**
 * Test Supabase Connection API Endpoint
 * POST - Test if Supabase credentials are valid
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { validateSupabaseCredentials } from '../../../utils/userSettings.js';
import { sendSuccess, sendError, validateMethod } from '../../../utils/apiHelpers.js';

async function handler(req, res) {
  if (!validateMethod(req, res, ['POST'])) return;

  const { supabase_url, supabase_key } = req.body;

  if (!supabase_url || !supabase_key) {
    return sendError(res, 'Supabase URL and API key are required', 400);
  }

  try {
    const result = await validateSupabaseCredentials(supabase_url, supabase_key);

    if (result.valid) {
      return sendSuccess(res, {
        message: 'Connection successful',
        buckets: result.buckets,
      });
    } else {
      return sendError(res, result.error || 'Connection failed', 400);
    }
  } catch (error) {
    console.error('Connection test error:', error);
    return sendError(res, error.message || 'Connection test failed', 500);
  }
}

export default withAuth(handler);
