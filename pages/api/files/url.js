import { validateMethod, validateQueryParams, sendSuccess, sendError } from '../../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../../utils/security';
import { withAuth } from '../../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../../utils/storageClientFactory.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;
  if (!validateQueryParams(req, res, ['path'])) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { settings } = storageResult;

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

  // Include access token in preview URL so browser can authenticate image/video requests
  const accessToken = req.accessToken;

  // Always use preview endpoint for reliability (works with both public and private buckets)
  sendSuccess(res, {
    url: `/api/preview?path=${encodeURIComponent(storagePath)}&bucket=${encodeURIComponent(bucketName)}&token=${encodeURIComponent(accessToken)}`,
  });
}

export default withAuth(handler);
