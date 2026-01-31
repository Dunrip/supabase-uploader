/**
 * Server-side utility functions (Node.js only - use in API routes)
 */
import fs from 'fs';
import path from 'path';

/**
 * Escape HTML content (for text nodes)
 * Escapes: < > & " '
 * NOTE: Not currently used (Next.js/React handles escaping automatically)
 * Reserved for future use cases like email templates or server-side HTML generation
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Escape HTML attribute values (for use in HTML attributes)
 * Escapes: < > & " ' and converts single quotes to &#39;
 * NOTE: Not currently used (Next.js/React handles escaping automatically)
 * Reserved for future use cases like email templates or server-side HTML generation
 * @param {string} text - Text to escape for attribute context
 * @returns {string} Escaped HTML attribute value
 */
export function escapeHtmlAttribute(text) {
  if (typeof text !== 'string') return '';
  return escapeHtml(text)
    .replace(/'/g, '&#39;')  // Ensure single quotes are escaped for attribute contexts
    .replace(/"/g, '&quot;'); // Also escape double quotes
}

/**
 * Escape JavaScript string for use in JavaScript code
 * Escapes quotes and backslashes for safe use in JavaScript strings
 * NOTE: Not currently used (Next.js/React handles escaping automatically)
 * Reserved for future use cases like email templates or server-side HTML generation
 * @param {string} text - Text to escape for JavaScript
 * @returns {string} Escaped JavaScript string
 */
export function escapeJsString(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
}

/**
 * Get or create temp directory
 * @returns {Promise<string>} Path to temp directory
 */
export async function getTempDir() {
  const uploadDir = path.join(process.cwd(), 'temp');
  await fs.promises.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

/**
 * Get default bucket name from environment
 * @returns {string} Default bucket name
 */
export function getDefaultBucket() {
  return process.env.SUPABASE_BUCKET || 'files';
}

/**
 * Clean up temporary file with retry logic
 * @param {string} filePath - Path to file to delete
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 100)
 * @returns {Promise<boolean>} True if file was deleted, false otherwise
 */
export async function cleanupTempFile(filePath, maxRetries = 3, retryDelay = 100) {
  if (!filePath) return false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (err) {
      // If file doesn't exist, we consider it cleaned up
      if (err.code === 'ENOENT') {
        return true;
      }
      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // Log failure after all retries exhausted
        console.warn(`Failed to delete temp file after ${maxRetries + 1} attempts:`, filePath, err.message);
        return false;
      }
    }
  }
  return false;
}

/**
 * Create timeout promise wrapper
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} Wrapped promise with timeout
 */
export function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage || 'Operation timed out')), timeoutMs)
    )
  ]);
}
