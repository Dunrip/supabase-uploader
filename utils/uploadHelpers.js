/**
 * Shared upload utility functions
 * Used by UploadTab and FilesTab components to avoid code duplication
 */

/**
 * Upload a file using XMLHttpRequest with progress tracking
 * @param {File} file - File to upload
 * @param {string} bucket - Bucket name
 * @param {Function} onProgress - Progress callback (progress: number) => void
 * @param {Function} onSuccess - Success callback (response: object) => void
 * @param {Function} onError - Error callback (error: string) => void
 * @param {string} folderPath - Optional folder path to upload to
 * @param {string} accessToken - Optional access token for authentication
 * @returns {XMLHttpRequest} The XHR object for potential cancellation
 */
export function uploadFileWithProgress(file, bucket, onProgress, onSuccess, onError, folderPath = '', accessToken = null) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);

  // If a folder path is provided, set the full path for the file
  if (folderPath) {
    const fullPath = `${folderPath}/${file.name}`;
    formData.append('path', fullPath);
  }

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable && onProgress) {
      const percent = Math.round((e.loaded / e.total) * 100);
      onProgress(percent);
    }
  });

  xhr.addEventListener('load', () => {
    try {
      let errorMessage = 'Upload failed';

      // Try to parse error response even if status is not 200
      if (xhr.responseText) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.error) {
            errorMessage = `Upload failed: ${response.error}`;
          }
        } catch (parseError) {
          // If parsing fails, use status text or default message
          errorMessage = xhr.statusText ? `Upload failed: ${xhr.statusText}` : 'Upload failed: Unknown error';
        }
      } else {
        errorMessage = xhr.statusText ? `Upload failed: ${xhr.statusText}` : 'Upload failed: Unknown error';
      }

      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          if (onSuccess) {
            onSuccess(response);
          }
        } else {
          const errorMsg = response.error ? `Upload failed: ${response.error}` : 'Upload failed';
          if (onError) {
            onError(errorMsg);
          }
        }
      } else {
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (e) {
      const errorMsg = `Upload failed: ${e.message || 'Parse error'}`;
      if (onError) {
        onError(errorMsg);
      }
    }
  });

  xhr.addEventListener('error', () => {
    if (onError) {
      onError('Upload failed: Network error');
    }
  });

  xhr.timeout = 300000; // 5 minutes
  xhr.addEventListener('timeout', () => {
    if (onError) {
      onError('Upload failed: Upload timeout - file may be too large or connection is slow');
    }
    xhr.abort();
  });

  xhr.open('POST', '/api/upload');

  // Set authorization header if token is provided
  if (accessToken) {
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
  }

  xhr.send(formData);

  return xhr;
}
