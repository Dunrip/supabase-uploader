import { validateMethod, validateQueryParams, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

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

  try {
    console.log('Preview request for path:', storagePath, 'in bucket:', bucketName);

    // Create a signed URL for the file
    // This offloads bandwidth to Supabase and is faster than proxying the file
    // We set expiry to 3600s (1 hour) to match the previous Cache-Control max-age
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 3600);

    // Note: createSignedUrl does not verify file existence efficiently.
    // The previous retry logic for double-encoded paths is removed as we cannot
    // easily detect "not found" without an extra round-trip which defeats the performance optimization.
    // If the path is incorrect, the signed URL will result in a 404 from Supabase.

    if (error) {
      console.error('Preview signed URL error:', error);
      return sendError(res, error.message || 'Failed to generate preview URL', 500);
    }

    if (!data || !data.signedUrl) {
      return sendError(res, 'Failed to generate preview URL', 500);
    }

    // Redirect to the signed URL
    res.redirect(data.signedUrl);
  } catch (error) {
    console.error('Preview error:', error);
    sendError(res, error.message || 'Failed to preview file', 500);
  }
}

export default withAuth(handler);
