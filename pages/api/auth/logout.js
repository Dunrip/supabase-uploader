/**
 * Logout API Endpoint
 * POST - Sign out the current user
 */
import { getAuthClientServer } from '../../../utils/authSupabaseClient.js';
import { sendSuccess, sendError, validateMethod } from '../../../utils/apiHelpers.js';

export default async function handler(req, res) {
  if (!validateMethod(req, res, ['POST'])) return;

  try {
    const supabase = getAuthClientServer();

    // Clear the session on Supabase side
    await supabase.auth.signOut();

    // Clear cookies
    res.setHeader('Set-Cookie', [
      'sb-access-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      'sb-refresh-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);

    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return sendError(res, 'Logout failed', 500);
  }
}
