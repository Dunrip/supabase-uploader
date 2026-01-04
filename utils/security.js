/**
 * Security utilities for input validation and protection
 */
import fs from 'fs';

// ============================================================================
// PATH TRAVERSAL PROTECTION
// ============================================================================

/**
 * Validate and sanitize storage path to prevent path traversal attacks
 * @param {string} path - Storage path to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export function validateStoragePath(path) {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required' };
  }

  // Trim whitespace
  const trimmed = path.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Path cannot be empty' };
  }

  // Check for path traversal patterns
  const traversalPatterns = [
    /\.\./,              // Parent directory reference
    /^\/|^\\/,           // Absolute paths (Unix or Windows)
    /^[a-zA-Z]:\\/,      // Windows drive letters (C:\, D:\, etc.)
    /^[a-zA-Z]:$/,       // Windows drive letters without slash
    /%2e%2e/i,           // URL encoded ..
    /%252e%252e/i,       // Double URL encoded ..
    /%c0%ae/i,           // UTF-8 overlong encoding for .
    /%c1%9c/i,           // UTF-8 overlong encoding for /
    /\x00/,              // Null byte
  ];

  for (const pattern of traversalPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Invalid path: contains forbidden characters or sequences' };
    }
  }

  // Check for consecutive slashes (could indicate manipulation attempts)
  if (/\/\/|\\\\/.test(trimmed)) {
    return { valid: false, error: 'Invalid path: contains consecutive path separators' };
  }

  // Normalize path separators to forward slashes
  const normalized = trimmed.replace(/\\/g, '/');

  // Remove leading/trailing slashes
  const sanitized = normalized.replace(/^\/+|\/+$/g, '');

  // Maximum path length (prevent extremely long paths)
  if (sanitized.length > 500) {
    return { valid: false, error: 'Path is too long (maximum 500 characters)' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate bucket name
 * Supabase allows: letters, numbers, hyphens, underscores, and dots
 * @param {string} bucketName - Bucket name to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBucketName(bucketName) {
  if (!bucketName || typeof bucketName !== 'string') {
    return { valid: false, error: 'Bucket name is required' };
  }

  const trimmed = bucketName.trim();

  // Length check first
  if (trimmed.length < 1 || trimmed.length > 63) {
    return { valid: false, error: 'Bucket name must be between 1 and 63 characters' };
  }

  // Bucket name should be alphanumeric with hyphens, underscores, and dots
  // Must start with a letter or number
  // Cannot have consecutive dots or end with a dot
  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Invalid bucket name: must start and end with letter/number (hyphens, underscores, and dots allowed in between)' };
  }

  // Check for consecutive dots (security measure)
  if (/\.\./.test(trimmed)) {
    return { valid: false, error: 'Invalid bucket name: cannot contain consecutive dots' };
  }

  return { valid: true };
}

/**
 * Validate filename
 * @param {string} filename - Filename to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
export function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required' };
  }

  const trimmed = filename.trim();

  // Check for path traversal in filename
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    return { valid: false, error: 'Invalid filename: contains path separators' };
  }

  // Check for null bytes
  if (trimmed.includes('\x00')) {
    return { valid: false, error: 'Invalid filename: contains null byte' };
  }

  // Maximum filename length
  if (trimmed.length > 255) {
    return { valid: false, error: 'Filename is too long (maximum 255 characters)' };
  }

  // Minimum filename length
  if (trimmed.length < 1) {
    return { valid: false, error: 'Filename cannot be empty' };
  }

  return { valid: true, sanitized: trimmed };
}

// ============================================================================
// FILE TYPE VALIDATION (MAGIC BYTES)
// ============================================================================

/**
 * Magic byte signatures for common file types
 * Format: { extension: { signature: Buffer, offset: number, mimeType: string } }
 */
const FILE_SIGNATURES = {
  // Images
  jpeg: { signatures: [[0xFF, 0xD8, 0xFF]], mimeType: 'image/jpeg' },
  png: { signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], mimeType: 'image/png' },
  gif: { signatures: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], mimeType: 'image/gif' },
  webp: { signatures: [[0x52, 0x49, 0x46, 0x46]], mimeType: 'image/webp', additionalCheck: (buffer) => buffer.slice(8, 12).toString() === 'WEBP' },
  bmp: { signatures: [[0x42, 0x4D]], mimeType: 'image/bmp' },
  ico: { signatures: [[0x00, 0x00, 0x01, 0x00]], mimeType: 'image/x-icon' },
  svg: { signatures: [], mimeType: 'image/svg+xml', textCheck: (content) => content.includes('<svg') },

  // Documents
  pdf: { signatures: [[0x25, 0x50, 0x44, 0x46]], mimeType: 'application/pdf' },

  // Archives
  zip: { signatures: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]], mimeType: 'application/zip' },
  gzip: { signatures: [[0x1F, 0x8B]], mimeType: 'application/gzip' },
  rar: { signatures: [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07]], mimeType: 'application/x-rar-compressed' },
  '7z': { signatures: [[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]], mimeType: 'application/x-7z-compressed' },
  tar: { signatures: [[0x75, 0x73, 0x74, 0x61, 0x72]], offset: 257, mimeType: 'application/x-tar' },

  // Audio
  mp3: { signatures: [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]], mimeType: 'audio/mpeg' },
  wav: { signatures: [[0x52, 0x49, 0x46, 0x46]], mimeType: 'audio/wav', additionalCheck: (buffer) => buffer.slice(8, 12).toString() === 'WAVE' },
  ogg: { signatures: [[0x4F, 0x67, 0x67, 0x53]], mimeType: 'audio/ogg' },
  flac: { signatures: [[0x66, 0x4C, 0x61, 0x43]], mimeType: 'audio/flac' },

  // Video
  mp4: { signatures: [], mimeType: 'video/mp4', additionalCheck: (buffer) => {
    const ftypOffset = 4;
    return buffer.slice(ftypOffset, ftypOffset + 4).toString() === 'ftyp';
  }},
  webm: { signatures: [[0x1A, 0x45, 0xDF, 0xA3]], mimeType: 'video/webm' },
  avi: { signatures: [[0x52, 0x49, 0x46, 0x46]], mimeType: 'video/x-msvideo', additionalCheck: (buffer) => buffer.slice(8, 12).toString() === 'AVI ' },
  mkv: { signatures: [[0x1A, 0x45, 0xDF, 0xA3]], mimeType: 'video/x-matroska' },
  mov: { signatures: [], mimeType: 'video/quicktime', additionalCheck: (buffer) => {
    const moovTypes = ['moov', 'mdat', 'ftyp', 'free', 'wide'];
    const type = buffer.slice(4, 8).toString();
    return moovTypes.includes(type);
  }},

  // Text/Code (allow these by extension)
  json: { signatures: [], mimeType: 'application/json', textCheck: () => true },
  txt: { signatures: [], mimeType: 'text/plain', textCheck: () => true },
  html: { signatures: [], mimeType: 'text/html', textCheck: (content) => content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('<!doctype') },
  css: { signatures: [], mimeType: 'text/css', textCheck: () => true },
  js: { signatures: [], mimeType: 'application/javascript', textCheck: () => true },
  md: { signatures: [], mimeType: 'text/markdown', textCheck: () => true },
  xml: { signatures: [], mimeType: 'application/xml', textCheck: (content) => content.includes('<?xml') || content.startsWith('<') },
  csv: { signatures: [], mimeType: 'text/csv', textCheck: () => true },
};

/**
 * Blocked file extensions (executables and potentially dangerous files)
 */
const BLOCKED_EXTENSIONS = [
  // Windows executables
  'exe', 'msi', 'dll', 'scr', 'cpl', 'com', 'pif',
  // Script files
  'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'ws', 'wsf', 'wsc', 'wsh',
  // Unix/Linux executables and scripts
  'sh', 'bash', 'zsh', 'csh', 'ksh', 'fish',
  // Other potentially dangerous
  'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk',
  'jar', 'war', 'ear',
  'reg', 'inf', 'lnk',
  // PHP and server-side scripts
  'php', 'php3', 'php4', 'php5', 'phtml', 'asp', 'aspx', 'jsp', 'cgi', 'pl', 'py', 'pyc', 'pyo',
];

/**
 * Check if a file extension is blocked
 * @param {string} filename - Filename to check
 * @returns {boolean}
 */
export function isBlockedExtension(filename) {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return BLOCKED_EXTENSIONS.includes(ext);
}

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string}
 */
function getExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Check if buffer matches a signature
 * @param {Buffer} buffer
 * @param {number[]} signature
 * @param {number} offset
 * @returns {boolean}
 */
function matchesSignature(buffer, signature, offset = 0) {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Validate file type by checking magic bytes
 * @param {string} filePath - Path to the file to check
 * @param {string} declaredFilename - The filename claimed by the upload
 * @returns {Promise<{valid: boolean, error?: string, detectedType?: string}>}
 */
export async function validateFileType(filePath, declaredFilename) {
  // First check if extension is blocked
  if (isBlockedExtension(declaredFilename)) {
    const ext = getExtension(declaredFilename);
    return {
      valid: false,
      error: `File type .${ext} is not allowed for security reasons`
    };
  }

  try {
    // Read first 512 bytes for signature checking
    const buffer = Buffer.alloc(512);
    const fd = await fs.promises.open(filePath, 'r');
    await fd.read(buffer, 0, 512, 0);
    await fd.close();

    const declaredExt = getExtension(declaredFilename);

    // Check against known signatures
    for (const [ext, config] of Object.entries(FILE_SIGNATURES)) {
      const { signatures, mimeType, offset = 0, additionalCheck, textCheck } = config;

      // Check binary signatures
      for (const sig of signatures) {
        if (matchesSignature(buffer, sig, offset)) {
          // If there's an additional check, run it
          if (additionalCheck && !additionalCheck(buffer)) {
            continue;
          }
          return { valid: true, detectedType: mimeType };
        }
      }

      // For text-based files, check content
      if (textCheck && declaredExt === ext) {
        const content = buffer.toString('utf8', 0, Math.min(buffer.length, 256));
        if (textCheck(content)) {
          return { valid: true, detectedType: mimeType };
        }
      }
    }

    // If no signature matched, check if it's a text file by extension
    const textExtensions = ['json', 'txt', 'html', 'css', 'md', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log'];
    if (textExtensions.includes(declaredExt)) {
      // Basic text file validation - check for binary content
      let nonPrintable = 0;
      for (let i = 0; i < Math.min(buffer.length, 256); i++) {
        const byte = buffer[i];
        // Allow common text characters (tabs, newlines, printable ASCII, common UTF-8)
        if (byte !== 0x00 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D &&
            (byte < 0x20 || byte === 0x7F) && byte < 0x80) {
          nonPrintable++;
        }
      }
      // If less than 10% non-printable, treat as text
      if (nonPrintable < 25) {
        return { valid: true, detectedType: 'text/plain' };
      }
    }

    // For unknown types, allow but log
    console.warn(`Unknown file type for: ${declaredFilename}`);
    return { valid: true, detectedType: 'application/octet-stream' };

  } catch (error) {
    console.error('File type validation error:', error);
    return { valid: false, error: 'Failed to validate file type' };
  }
}

/**
 * Quick extension-only check for client-side pre-validation
 * @param {string} filename
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFileExtension(filename) {
  if (isBlockedExtension(filename)) {
    const ext = getExtension(filename);
    return {
      valid: false,
      error: `File type .${ext} is not allowed for security reasons`
    };
  }
  return { valid: true };
}
