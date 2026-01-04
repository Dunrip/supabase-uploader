/**
 * Login API Endpoint
 * POST - Sign in with email and password
 */
import { getAuthClientServer } from '../../../utils/authSupabaseClient.js';
import { sendSuccess, sendError, validateMethod } from '../../../utils/apiHelpers.js';

export default async function handler(req, res) {
  if (!validateMethod(req, res, ['POST'])) return;

  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  try {
    const supabase = getAuthClientServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return sendError(res, error.message, 401);
    }

    // Set cookies for session
    if (data.session) {
      // Set access token cookie
      res.setHeader('Set-Cookie', [
        `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
        `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
      ]);
    }

    return sendSuccess(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 'Login failed', 500);
  }
}
