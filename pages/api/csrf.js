/**
 * CSRF Token API Endpoint
 * GET - Generate a new CSRF token and set cookie
 */
import { createSignedCsrfToken, getCsrfSecret, setCsrfCookie, CSRF_CONFIG } from '../../utils/csrf.js';
import { sendSuccess, sendError, validateMethod } from '../../utils/apiHelpers.js';

export default function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  try {
    const secret = getCsrfSecret();
    const { token, combined } = createSignedCsrfToken(secret);

    // Set the full signed token in a cookie
    setCsrfCookie(res, combined);

    // Return only the token part for the client to use in headers
    // The cookie contains the full signed token for verification
    return sendSuccess(res, {
      token,
      headerName: CSRF_CONFIG.HEADER_NAME,
      message: 'CSRF token generated',
    });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return sendError(res, 'Failed to generate CSRF token', 500);
  }
}
