/**
 * Resumable Upload Utilities
 * Implements TUS protocol for large file uploads with pause/resume capability
 *
 * TUS (The Upload Server) protocol enables:
 * - Resumable uploads that survive network interruptions
 * - Pause and resume capability
 * - Progress tracking
 * - Automatic retry with exponential backoff
 *
 * @see https://tus.io/
 * @see https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */

// Threshold for using resumable uploads (6MB - Supabase's recommended minimum)
export const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024;

// TUS chunk size must be exactly 6MB for Supabase
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

/**
 * Upload state enum for tracking upload progress
 */
export const UploadState = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * Check if a file should use resumable upload
 * @param {number} fileSize - File size in bytes
 * @returns {boolean} True if file should use resumable upload
 */
export function shouldUseResumableUpload(fileSize) {
  return fileSize > RESUMABLE_UPLOAD_THRESHOLD;
}

/**
 * Get the TUS endpoint URL for a Supabase project
 * Uses the direct storage hostname for better performance
 * @param {string} supabaseUrl - Full Supabase URL (e.g., https://xxx.supabase.co)
 * @returns {string} TUS endpoint URL
 */
export function getTusEndpoint(supabaseUrl) {
  // Extract project ID from URL
  // Format: https://[project-id].supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    // Fallback for custom domains or different formats
    return `${supabaseUrl}/storage/v1/upload/resumable`;
  }
  const projectId = match[1];
  // Use direct storage hostname for better performance
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

/**
 * Get content type based on file extension
 * @param {string} fileName - File name with extension
 * @returns {string} MIME type
 */
function getContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const contentTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'bmp': 'image/bmp',
    // Videos
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    // Code/Text
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'md': 'text/markdown',
    'csv': 'text/csv',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Create a resumable upload using the TUS protocol
 * This is a client-side implementation that works with Supabase Storage
 *
 * @param {Object} options - Upload options
 * @param {File} options.file - File to upload
 * @param {string} options.bucketName - Supabase bucket name
 * @param {string} options.objectPath - Path within the bucket (including filename)
 * @param {string} options.supabaseUrl - Supabase project URL
 * @param {string} options.accessToken - User's access token for authentication
 * @param {boolean} options.upsert - Whether to overwrite existing files (default: true)
 * @param {Function} options.onProgress - Progress callback (bytesUploaded, bytesTotal, percentage)
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback (error)
 * @param {Object} options.customMetadata - Optional custom metadata to store with the file
 * @returns {Object} Upload controller with pause/resume/abort methods
 */
export function createResumableUpload(options) {
  const {
    file,
    bucketName,
    objectPath,
    supabaseUrl,
    accessToken,
    upsert = true,
    onProgress,
    onSuccess,
    onError,
    customMetadata = {},
  } = options;

  // State management
  let state = UploadState.PENDING;
  let uploadUrl = null;
  let offset = 0;
  let aborted = false;
  let currentXhr = null;

  // Retry configuration
  const retryDelays = [0, 3000, 5000, 10000, 20000];
  let retryAttempt = 0;

  const tusEndpoint = getTusEndpoint(supabaseUrl);
  const contentType = getContentType(file.name);

  /**
   * Start or resume the upload
   */
  async function start() {
    if (aborted) return;

    try {
      if (!uploadUrl) {
        // Create new upload
        state = UploadState.UPLOADING;
        await createUpload();
      } else {
        // Resume existing upload
        state = UploadState.UPLOADING;
        await resumeUpload();
      }
    } catch (error) {
      handleError(error);
    }
  }

  /**
   * Create a new TUS upload session
   */
  async function createUpload() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;

      xhr.open('POST', tusEndpoint, true);

      // TUS headers
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');
      xhr.setRequestHeader('Upload-Length', file.size.toString());

      // Metadata (base64 encoded key-value pairs)
      const metadata = [
        `bucketName ${btoa(bucketName)}`,
        `objectName ${btoa(objectPath)}`,
        `contentType ${btoa(contentType)}`,
        `cacheControl ${btoa('3600')}`,
      ];

      // Add custom metadata if provided
      if (Object.keys(customMetadata).length > 0) {
        metadata.push(`metadata ${btoa(JSON.stringify(customMetadata))}`);
      }

      xhr.setRequestHeader('Upload-Metadata', metadata.join(','));

      // Upsert header
      if (upsert) {
        xhr.setRequestHeader('x-upsert', 'true');
      }

      xhr.onload = () => {
        if (xhr.status === 201) {
          uploadUrl = xhr.getResponseHeader('Location');
          if (uploadUrl) {
            // Start uploading data
            uploadChunk().then(resolve).catch(reject);
          } else {
            reject(new Error('No upload URL received'));
          }
        } else {
          reject(new Error(`Failed to create upload: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error creating upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      xhr.send();
    });
  }

  /**
   * Resume an existing upload by getting the current offset
   */
  async function resumeUpload() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;

      xhr.open('HEAD', uploadUrl, true);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');

      xhr.onload = () => {
        if (xhr.status === 200) {
          const serverOffset = parseInt(xhr.getResponseHeader('Upload-Offset') || '0', 10);
          offset = serverOffset;
          uploadChunk().then(resolve).catch(reject);
        } else if (xhr.status === 404) {
          // Upload expired or not found, start fresh
          uploadUrl = null;
          offset = 0;
          createUpload().then(resolve).catch(reject);
        } else {
          reject(new Error(`Failed to resume upload: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error resuming upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      xhr.send();
    });
  }

  /**
   * Upload file data in chunks
   */
  async function uploadChunk() {
    if (aborted || state === UploadState.PAUSED) return;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;

      xhr.open('PATCH', uploadUrl, true);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');
      xhr.setRequestHeader('Upload-Offset', offset.toString());
      xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');

      // Progress tracking
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const bytesUploaded = offset + e.loaded;
          const percentage = Math.round((bytesUploaded / file.size) * 100);
          onProgress(bytesUploaded, file.size, percentage);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 204) {
          // Chunk uploaded successfully
          const newOffset = parseInt(xhr.getResponseHeader('Upload-Offset') || '0', 10);
          offset = newOffset;
          retryAttempt = 0;

          if (offset >= file.size) {
            // Upload complete
            state = UploadState.COMPLETED;
            if (onSuccess) {
              onSuccess({
                path: objectPath,
                bucket: bucketName,
                size: file.size,
              });
            }
            resolve();
          } else if (state !== UploadState.PAUSED && !aborted) {
            // Continue uploading
            uploadChunk().then(resolve).catch(reject);
          } else {
            resolve();
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => {
        if (!aborted && state !== UploadState.PAUSED) {
          reject(new Error('Upload aborted'));
        } else {
          resolve();
        }
      };

      // Slice the file for this chunk
      const chunk = file.slice(offset, offset + TUS_CHUNK_SIZE);
      xhr.send(chunk);
    });
  }

  /**
   * Handle upload errors with retry logic
   */
  function handleError(error) {
    if (aborted) return;

    if (retryAttempt < retryDelays.length) {
      const delay = retryDelays[retryAttempt];
      retryAttempt++;
      console.warn(`Upload error, retrying in ${delay}ms:`, error.message);
      setTimeout(() => start(), delay);
    } else {
      state = UploadState.ERROR;
      if (onError) {
        onError(error);
      }
    }
  }

  /**
   * Pause the upload
   */
  function pause() {
    if (state === UploadState.UPLOADING) {
      state = UploadState.PAUSED;
      if (currentXhr) {
        currentXhr.abort();
        currentXhr = null;
      }
    }
  }

  /**
   * Resume the upload after pause
   */
  function resume() {
    if (state === UploadState.PAUSED) {
      start();
    }
  }

  /**
   * Abort the upload completely
   */
  function abort() {
    aborted = true;
    state = UploadState.ERROR;
    if (currentXhr) {
      currentXhr.abort();
      currentXhr = null;
    }
  }

  /**
   * Get current upload state
   */
  function getState() {
    return state;
  }

  /**
   * Get current upload progress
   */
  function getProgress() {
    return {
      bytesUploaded: offset,
      bytesTotal: file.size,
      percentage: Math.round((offset / file.size) * 100),
    };
  }

  // Return controller object
  return {
    start,
    pause,
    resume,
    abort,
    getState,
    getProgress,
  };
}

/**
 * Simple wrapper for uploading a file with resumable upload support
 * Falls back to standard upload for small files
 *
 * @param {File} file - File to upload
 * @param {string} bucket - Bucket name
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} accessToken - Access token
 * @param {Function} onProgress - Progress callback (percentage)
 * @param {Function} onSuccess - Success callback (response)
 * @param {Function} onError - Error callback (error message)
 * @param {string} folderPath - Optional folder path
 * @returns {Object} Upload controller or null for standard upload
 */
export function uploadWithResumable(file, bucket, supabaseUrl, accessToken, onProgress, onSuccess, onError, folderPath = '') {
  const objectPath = folderPath ? `${folderPath}/${file.name}` : file.name;

  // Check if file should use resumable upload
  if (!shouldUseResumableUpload(file.size)) {
    // Return null to indicate standard upload should be used
    return null;
  }

  // Create and start resumable upload
  const upload = createResumableUpload({
    file,
    bucketName: bucket,
    objectPath,
    supabaseUrl,
    accessToken,
    onProgress: (bytesUploaded, bytesTotal, percentage) => {
      if (onProgress) onProgress(percentage);
    },
    onSuccess: (result) => {
      if (onSuccess) onSuccess(result);
    },
    onError: (error) => {
      if (onError) onError(error.message || 'Resumable upload failed');
    },
  });

  upload.start();
  return upload;
}
