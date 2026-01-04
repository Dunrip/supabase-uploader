/**
 * Encryption utilities for securing user API keys at rest
 * Uses AES-256-GCM for authenticated encryption
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment
 * @returns {Buffer}
 */
function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Support both hex and base64 formats
  let keyBuffer;
  if (/^[a-f0-9]+$/i.test(keyHex) && keyHex.length === 64) {
    // Hex format (64 chars = 32 bytes)
    keyBuffer = Buffer.from(keyHex, 'hex');
  } else {
    // Try base64
    keyBuffer = Buffer.from(keyHex, 'base64');
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex chars or 44 base64 chars)`);
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext - The text to encrypt
 * @returns {string} Base64-encoded ciphertext (IV + authTag + encrypted)
 */
export function encrypt(plaintext) {
  if (!plaintext) {
    return '';
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext string
 * @param {string} ciphertext - Base64-encoded ciphertext (IV + authTag + encrypted)
 * @returns {string} Decrypted plaintext
 */
export function decrypt(ciphertext) {
  if (!ciphertext) {
    return '';
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract IV, authTag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt a user's Supabase API key
 * @param {string} apiKey - The Supabase API key to encrypt
 * @returns {string} Encrypted key
 */
export function encryptApiKey(apiKey) {
  return encrypt(apiKey);
}

/**
 * Decrypt a user's Supabase API key
 * @param {string} encryptedKey - The encrypted API key
 * @returns {string} Decrypted API key
 */
export function decryptApiKey(encryptedKey) {
  return decrypt(encryptedKey);
}

/**
 * Generate a random encryption key (for setup)
 * @returns {string} 64-character hex string
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Mask an API key for display (show first 8 and last 4 characters)
 * @param {string} apiKey - The API key to mask
 * @returns {string} Masked key like "eyJhbGci...abcd"
 */
export function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 16) {
    return '••••••••';
  }
  return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Validate encryption key format
 * @param {string} key - The key to validate
 * @returns {boolean}
 */
export function isValidEncryptionKey(key) {
  if (!key) return false;

  // Check hex format
  if (/^[a-f0-9]+$/i.test(key) && key.length === 64) {
    return true;
  }

  // Check base64 format
  try {
    const decoded = Buffer.from(key, 'base64');
    return decoded.length === KEY_LENGTH;
  } catch {
    return false;
  }
}
