import path from 'path';
import { Readable } from 'stream';
import { validateMethod, validateQueryParams, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

// File size threshold for streaming vs temp file (50MB)
const STREAMING_THRESHOLD = 50 * 1024 * 1024;

async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;
  if (!validateQueryParams(req, res, ['path'])) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  // Validate storage path (prevent path traversal)
  const pathValidation = validateStoragePath(req.query.path);
  if (!pathValidation.valid) {
    return sendError(res, pathValidation.error, 400);
  }
  const storagePath = pathValidation.sanitized;

  // Validate bucket name
  const bucketName = req.query.bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  const fileName = path.basename(storagePath);

  try {

    // Download file from Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (error) {
      console.error('Download error:', error);
      return sendError(res, error.message || 'File not found', 404);
    }

    if (!data) {
      return sendError(res, 'File not found', 404);
    }

    // Properly escape filename for Content-Disposition header
    // RFC 5987: Use both filename and filename* for maximum compatibility
    const safeFileName = fileName.replace(/"/g, '\\"').replace(/\n/g, '');
    const encodedFileName = encodeURIComponent(fileName);

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Type', data.type || 'application/octet-stream');
    res.setHeader('Content-Length', data.size);

    // Stream the blob data directly to the response
    // This avoids loading the entire file into memory
    const buffer = Buffer.from(await data.arrayBuffer());

    // For large files, use streaming; for smaller files, send directly
    if (buffer.length > STREAMING_THRESHOLD) {
      // Create a readable stream from the buffer
      const stream = Readable.from(buffer);

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          sendError(res, 'Failed to stream file', 500);
        }
      });

      stream.pipe(res);
    } else {
      // For smaller files, send the buffer directly
      res.send(buffer);
    }
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      sendError(res, error.message || 'Failed to download file', 500);
    }
  }
}

export default withAuth(handler);
