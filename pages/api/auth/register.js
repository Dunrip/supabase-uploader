/**
 * Register API Endpoint
 * POST - Create a new user account
 */
import { getAuthClientServer } from '../../../utils/authSupabaseClient.js';
import { sendSuccess, sendError, validateMethod } from '../../../utils/apiHelpers.js';

export default async function handler(req, res) {
  if (!validateMethod(req, res, ['POST'])) return;

  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendError(res, 'Invalid email address', 400);
  }

  try {
    const supabase = getAuthClientServer();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return sendError(res, error.message, 400);
    }

    // Check if user needs to confirm email
    const needsConfirmation = data.user && !data.session;

    return sendSuccess(res, {
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
      } : null,
      needsConfirmation,
      message: needsConfirmation
        ? 'Please check your email to confirm your account'
        : 'Account created successfully',
    });
  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, 'Registration failed', 500);
  }
}
