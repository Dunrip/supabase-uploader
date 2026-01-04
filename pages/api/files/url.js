import { getSupabaseClient } from '../../../utils/supabaseClient';
import { getDefaultBucket } from '../../../utils/serverHelpers';
import { validateMethod, validateQueryParams, sendSuccess, sendError } from '../../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../../utils/security';

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

    // Try to get public URL first
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    // Always use preview endpoint for reliability (works with both public and private buckets)
    // The preview endpoint will handle file access properly
    sendSuccess(res, {
      url: `/api/preview?path=${encodeURIComponent(storagePath)}&bucket=${encodeURIComponent(bucketName)}`,
    });
  } catch (error) {
    console.error('Get URL error:', error);
    // Fallback to preview endpoint on any error
    sendSuccess(res, {
      url: `/api/preview?path=${encodeURIComponent(storagePath)}&bucket=${encodeURIComponent(bucketName)}`,
    });
  }
}
