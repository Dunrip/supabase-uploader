import path from 'path';
import { getSupabaseClient } from '../../utils/supabaseClient';
import { getDefaultBucket } from '../../utils/serverHelpers';
import { validateMethod, validateQueryParams, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';

export default async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;
  if (!validateQueryParams(req, res, ['path'])) return;

  // Validate storage path (prevent path traversal)
  const pathValidation = validateStoragePath(req.query.path);
  if (!pathValidation.valid) {
    return sendError(res, pathValidation.error, 400);
  }
  const storagePath = pathValidation.sanitized;

  // Validate bucket name
  const bucketName = req.query.bucket || getDefaultBucket();
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  try {
    const supabase = getSupabaseClient();

    // Try to get the file from storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (error) {
      console.error('Preview download error:', error);

      // Provide more specific error messages
      if (error.message && error.message.includes('Bucket not found')) {
        return sendError(res, `Bucket "${bucketName}" not found. Please check the bucket name.`, 404);
      }

      if (error.message && (error.message.includes('Object not found') || error.message.includes('not found'))) {
        return sendError(res, `File "${storagePath}" not found in bucket "${bucketName}"`, 404);
      }

      return sendError(res, error.message || 'File not found', 404);
    }

    if (!data) {
      return sendError(res, 'File not found', 404);
    }

    // Get file extension to determine content type
    const ext = path.extname(storagePath).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Properly escape filename for Content-Disposition header
    // RFC 5987: Use both filename and filename* for maximum compatibility
    const fileName = path.basename(storagePath);
    const safeFileName = fileName.replace(/"/g, '\\"').replace(/\n/g, '');
    const encodedFileName = encodeURIComponent(fileName);

    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);

    res.send(buffer);
  } catch (error) {
    console.error('Preview error:', error);
    sendError(res, error.message || 'Failed to preview file', 500);
  }
}
