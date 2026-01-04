/**
 * Storage Operations
 * Server-side storage functions that work with dynamic Supabase clients
 * These are used by API routes with per-user credentials
 */
import fs from 'fs';
import path from 'path';

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sanitize storage path to be safe for Supabase Storage
 * Handles non-ASCII characters (Thai, Chinese, etc.) by replacing with safe ASCII
 * @param {string} storagePath - Original storage path
 * @returns {string} Sanitized storage path
 */
export function sanitizeStoragePath(storagePath) {
  if (!storagePath) return storagePath;

  // Split path into parts to preserve folder structure
  const parts = storagePath.split('/');

  const sanitizedParts = parts.map(part => {
    if (!part) return part;

    // Get file extension if present
    const lastDotIndex = part.lastIndexOf('.');
    let name = lastDotIndex > 0 ? part.substring(0, lastDotIndex) : part;
    const extension = lastDotIndex > 0 ? part.substring(lastDotIndex) : '';

    // Check if name contains non-ASCII characters
    let hasNonAscii = false;
    let sanitized = '';

    for (const char of name) {
      const code = char.charCodeAt(0);
      // Keep ASCII alphanumeric, hyphen, underscore
      if ((code >= 48 && code <= 57) ||  // 0-9
        (code >= 65 && code <= 90) ||  // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === '-' || char === '_') {
        sanitized += char;
      } else if (char === ' ') {
        // Replace spaces with underscores
        sanitized += '_';
      } else if (code > 127) {
        // Non-ASCII character - mark and skip
        hasNonAscii = true;
      } else {
        // Other ASCII special chars - replace with underscore
        sanitized += '_';
      }
    }

    // Remove consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_').replace(/^_|_$/g, '');

    // If the original had non-ASCII chars and we have little/no ASCII left, 
    // generate a unique filename
    if (hasNonAscii && sanitized.length < 3) {
      // Generate a unique name using timestamp and random string
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      sanitized = `file_${timestamp}_${random}`;
    } else if (hasNonAscii) {
      // Add a short hash to ensure uniqueness when non-ASCII chars were stripped
      const hash = Math.random().toString(36).substring(2, 6);
      sanitized = `${sanitized}_${hash}`;
    }

    // Ensure we have a valid filename (not empty)
    if (!sanitized) {
      sanitized = 'file_' + Date.now().toString(36);
    }

    return sanitized + extension;
  });

  return sanitizedParts.join('/');
}

/**
 * Get content type based on file extension
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
export function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.xml': 'application/xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
export async function retryWithBackoff(fn, maxRetries = 3) {
  const RETRY_DELAY_BASE = 1000;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Upload a file to Supabase Storage
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} filePath - Local file path
 * @param {string} bucketName - Bucket name
 * @param {string} storagePath - Path in bucket
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<Object>} Upload result
 */
export async function uploadFile(supabase, filePath, bucketName, storagePath, maxRetries = 3) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileName = path.basename(filePath);
    const rawStoragePath = storagePath || fileName;
    // Sanitize path to handle non-ASCII characters (Thai, Chinese, etc.)
    const finalStoragePath = sanitizeStoragePath(rawStoragePath);

    const fileBuffer = fs.readFileSync(filePath);

    const uploadResult = await retryWithBackoff(async () => {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(finalStoragePath, fileBuffer, {
          contentType: getContentType(filePath),
          upsert: true,
        });

      if (error) throw error;
      return data;
    }, maxRetries);

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(finalStoragePath);

    return {
      success: true,
      path: uploadResult.path,
      id: uploadResult.id,
      publicUrl: urlData.publicUrl,
      size: fileSize,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List files in a bucket
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} bucketName - Bucket name
 * @param {string} folderPath - Folder path
 * @param {number} limit - Max files to fetch
 * @returns {Promise<Array>} List of files
 */
export async function listFiles(supabase, bucketName, folderPath = '', limit = 1000) {
  try {
    const allFiles = [];
    let offset = 0;
    const batchSize = 100;

    while (offset < limit) {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, {
          limit: Math.min(batchSize, limit - offset),
          offset: offset,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      if (!data || data.length === 0) break;

      allFiles.push(...data);
      offset += data.length;

      if (data.length < batchSize) break;
    }

    return allFiles;
  } catch (error) {
    console.error('Error listing files:', error.message);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFile(supabase, storagePath, bucketName, maxRetries = 3) {
  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (error) throw error;
      return true;
    }, maxRetries);

    return true;
  } catch (error) {
    console.error('Delete failed:', error.message);
    throw error;
  }
}

/**
 * Delete multiple files from Supabase Storage
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Array<string>} storagePaths - Paths in bucket
 * @param {string} bucketName - Bucket name
 * @returns {Promise<Object>} Result with success count
 */
export async function deleteFiles(supabase, storagePaths, bucketName) {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove(storagePaths);

    if (error) throw error;

    return { success: true, count: storagePaths.length };
  } catch (error) {
    console.error('Bulk delete failed:', error.message);
    throw error;
  }
}

/**
 * Download a file from Supabase Storage
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<Buffer>} File buffer
 */
export async function downloadFile(supabase, storagePath, bucketName, maxRetries = 3) {
  const fileData = await retryWithBackoff(async () => {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (error) throw error;
    if (!data) throw new Error(`File not found: ${storagePath}`);

    return data;
  }, maxRetries);

  const arrayBuffer = await fileData.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Rename/move a file in Supabase Storage
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} oldPath - Current path
 * @param {string} newPath - New path
 * @param {string} bucketName - Bucket name
 * @returns {Promise<Object>} Result
 */
export async function renameFile(supabase, oldPath, newPath, bucketName) {
  try {
    // Check if destination exists
    const { data: existingFiles } = await supabase.storage
      .from(bucketName)
      .list(path.dirname(newPath) || '', {
        search: path.basename(newPath),
      });

    const exists = existingFiles?.some(f => f.name === path.basename(newPath));
    if (exists) {
      return { success: false, error: 'A file with this name already exists' };
    }

    // Supabase doesn't have a native rename, so we copy and delete
    const { error: moveError } = await supabase.storage
      .from(bucketName)
      .move(oldPath, newPath);

    if (moveError) throw moveError;

    return { success: true, path: newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a folder (using .folder placeholder)
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} folderPath - Folder path
 * @param {string} bucketName - Bucket name
 * @returns {Promise<Object>} Result
 */
export async function createFolder(supabase, folderPath, bucketName) {
  try {
    const placeholderPath = `${folderPath}/.folder`;
    const placeholderContent = Buffer.from('');

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(placeholderPath, placeholderContent, {
        contentType: 'application/x-empty',
        upsert: false,
      });

    if (error) {
      if (error.message?.includes('already exists')) {
        return { success: false, error: 'Folder already exists' };
      }
      throw error;
    }

    return { success: true, path: folderPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List all buckets
 * @param {SupabaseClient} supabase - Supabase client instance
 * @returns {Promise<Array>} List of buckets
 */
export async function listBuckets(supabase) {
  const { data, error } = await supabase.storage.listBuckets();

  if (error) throw error;

  return data || [];
}

/**
 * Get a signed URL for a file
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @param {number} expiresIn - Expiry time in seconds
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedUrl(supabase, storagePath, bucketName, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;

  return data.signedUrl;
}

/**
 * Get a public URL for a file
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @returns {string} Public URL
 */
export function getPublicUrl(supabase, storagePath, bucketName) {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
