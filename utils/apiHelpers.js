/**
 * Unified API response helpers for consistent error/success responses
 */

/**
 * Send a standardized success response
 * @param {object} res - Next.js response object
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
}

/**
 * Send a standardized error response
 * @param {object} res - Next.js response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {object} additionalData - Additional data to include in response
 */
export function sendError(res, error, statusCode = 500, additionalData = {}) {
  return res.status(statusCode).json({
    success: false,
    error: error || 'An unknown error occurred',
    ...additionalData,
  });
}

/**
 * Handle method validation
 * @param {object} req - Next.js request object
 * @param {object} res - Next.js response object
 * @param {string|string[]} allowedMethods - Allowed HTTP method(s)
 * @returns {boolean} True if method is allowed, false otherwise
 */
export function validateMethod(req, res, allowedMethods) {
  const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];

  if (!methods.includes(req.method)) {
    sendError(res, 'Method not allowed', 405);
    return false;
  }

  return true;
}

/**
 * Validate required query parameters
 * @param {object} req - Next.js request object
 * @param {object} res - Next.js response object
 * @param {string[]} requiredParams - Array of required parameter names
 * @returns {boolean} True if all required params are present, false otherwise
 */
export function validateQueryParams(req, res, requiredParams) {
  const missing = requiredParams.filter(param => !req.query[param]);

  if (missing.length > 0) {
    sendError(
      res,
      `Missing required parameter(s): ${missing.join(', ')}`,
      400
    );
    return false;
  }

  return true;
}
