import { validateMethod, validateQueryParams, sendSuccess, sendError } from '../../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../../utils/security';
import { withAuth } from '../../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../../utils/storageClientFactory.js';
import {
  getSignedUrlPolicyConfig,
  resolveSignedUrlTtl,
  resolveAllowedPrefixes,
  isObjectKeyAllowed,
} from '../../../utils/signedUrlPolicy.mjs';

async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;
  if (!validateQueryParams(req, res, ['path'])) return;

  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  const pathValidation = validateStoragePath(req.query.path);
  if (!pathValidation.valid) {
    return sendError(res, pathValidation.error, 400);
  }
  const storagePath = pathValidation.sanitized;

  const bucketName = req.query.bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  const policyConfig = getSignedUrlPolicyConfig();
  const ttlResult = resolveSignedUrlTtl(req.query.ttl, policyConfig);
  if (!ttlResult.valid) {
    return sendError(res, ttlResult.error, 400);
  }

  const allowedPrefixes = resolveAllowedPrefixes(req.user?.id, policyConfig);
  if (!isObjectKeyAllowed(storagePath, allowedPrefixes)) {
    return sendError(res, 'Access denied for requested object key scope', 403);
  }

  const download = req.query.download === '1' || req.query.download === 'true';

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, ttlResult.ttl, download ? { download: true } : undefined);

    if (error) {
      console.error('Signed URL retrieval error:', error);
      return sendError(res, error.message || 'Failed to generate signed URL', 500);
    }

    if (!data?.signedUrl) {
      return sendError(res, 'Failed to generate signed URL', 500);
    }

    return sendSuccess(res, {
      signedUrl: data.signedUrl,
      expiresIn: ttlResult.ttl,
      bucket: bucketName,
      path: storagePath,
    });
  } catch (error) {
    console.error('Signed URL retrieval error:', error);
    return sendError(res, error.message || 'Failed to generate signed URL', 500);
  }
}

export default withAuth(handler);
