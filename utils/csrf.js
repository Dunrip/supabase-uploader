/**
 * CSRF Protection Utilities
 * Generates and validates CSRF tokens for state-changing operations
 */
import crypto from 'crypto';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32; // 256 bits
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} Hex-encoded CSRF token
 */
export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token with timestamp
 * @param {string} secret - Secret key for signing (use ENCRYPTION_KEY from env)
 * @returns {{ token: string, signature: string, timestamp: number }}
 */
export function createSignedCsrfToken(secret) {
  const token = generateCsrfToken();
  const timestamp = Date.now();
  const data = `${token}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  return {
    token,
    signature,
    timestamp,
    // Combined value for cookie storage
    combined: `${token}.${timestamp}.${signature}`,
  };
}

/**
 * Verify a signed CSRF token
 * @param {string} combined - Combined token string (token.timestamp.signature)
 * @param {string} secret - Secret key for verification
 * @returns {{ valid: boolean, error?: string }}
 */
export function verifySignedCsrfToken(combined, secret) {
  if (!combined || typeof combined !== 'string') {
    return { valid: false, error: 'Missing CSRF token' };
  }

  const parts = combined.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid CSRF token format' };
  }

  const [token, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid CSRF token timestamp' };
  }

  // Check expiry
  if (Date.now() - timestamp > CSRF_TOKEN_EXPIRY) {
    return { valid: false, error: 'CSRF token expired' };
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${token}.${timestamp}`)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  // Wrap in try-catch because timingSafeEqual throws if buffer lengths differ
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, error: 'Invalid CSRF token signature' };
    }
  } catch {
    return { valid: false, error: 'Invalid CSRF token signature' };
  }

  return { valid: true };
}

/**
 * Extract CSRF token from request
 * Checks header first, then body
 * @param {object} req - Next.js API request
 * @returns {string|null} CSRF token or null
 */
export function extractCsrfToken(req) {
  // Check header first (preferred method)
  const headerToken = req.headers[CSRF_HEADER_NAME] || req.headers[CSRF_HEADER_NAME.toLowerCase()];
  if (headerToken) {
    return headerToken;
  }

  // Check body for form submissions
  if (req.body && req.body._csrf) {
    return req.body._csrf;
  }

  return null;
}

/**
 * Extract CSRF cookie from request
 * @param {object} req - Next.js API request
 * @returns {string|null} CSRF cookie value or null
 */
export function extractCsrfCookie(req) {
  const cookies = req.cookies || {};
  return cookies[CSRF_COOKIE_NAME] || null;
}

/**
 * Validate CSRF token for a request
 * Compares token from header/body against cookie value
 * @param {object} req - Next.js API request
 * @param {string} secret - Secret key for verification
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCsrfRequest(req, secret) {
  // Only validate for state-changing methods
  const method = req.method?.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return { valid: true }; // Skip validation for safe methods
  }

  // Get token from request (header or body)
  const requestToken = extractCsrfToken(req);
  if (!requestToken) {
    return { valid: false, error: 'Missing CSRF token in request' };
  }

  // Get token from cookie
  const cookieToken = extractCsrfCookie(req);
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF cookie' };
  }

  // Verify the cookie token is valid (signed and not expired)
  const cookieVerification = verifySignedCsrfToken(cookieToken, secret);
  if (!cookieVerification.valid) {
    return cookieVerification;
  }

  // Compare request token with the token part of the cookie
  // The cookie contains: token.timestamp.signature
  // The request should contain just the token part
  const [cookieTokenPart] = cookieToken.split('.');

  // Use timing-safe comparison
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(requestToken),
      Buffer.from(cookieTokenPart)
    );
    if (!isMatch) {
      return { valid: false, error: 'CSRF token mismatch' };
    }
  } catch {
    // Buffer lengths don't match
    return { valid: false, error: 'CSRF token mismatch' };
  }

  return { valid: true };
}

/**
 * Set CSRF cookie on response
 * @param {object} res - Next.js API response
 * @param {string} combinedToken - Combined token string (token.timestamp.signature)
 * @param {boolean} isProduction - Whether running in production mode
 */
export function setCsrfCookie(res, combinedToken, isProduction = process.env.NODE_ENV === 'production') {
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${combinedToken}`,
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(CSRF_TOKEN_EXPIRY / 1000)}`, // Convert to seconds
  ];

  // Only set Secure flag in production (requires HTTPS)
  if (isProduction) {
    cookieOptions.push('Secure');
  }

  // Note: We intentionally do NOT set HttpOnly here
  // because the client needs to read the token to send it in headers
  // The token is signed and verified server-side for security

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

/**
 * Get the CSRF secret key from environment
 * Falls back to ENCRYPTION_KEY if CSRF_SECRET is not set
 * @returns {string}
 */
export function getCsrfSecret() {
  const secret = process.env.CSRF_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('CSRF_SECRET or ENCRYPTION_KEY environment variable is required');
  }
  return secret;
}

// Export constants for use in other modules
export const CSRF_CONFIG = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  TOKEN_EXPIRY: CSRF_TOKEN_EXPIRY,
};
