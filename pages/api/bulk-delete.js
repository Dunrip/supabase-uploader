import { validateMethod, sendError, sendSuccess } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
import { deleteFiles } from '../../utils/storageOperations';
import { withAuth } from '../../utils/authMiddleware.js';
import { enforceRole } from '../../utils/rbac.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;
  if (!enforceRole(req, res, 'operator')) return;
  if (!enforceRole(req, res, 'operator')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  const { paths, bucket } = req.body;

  // Validate paths array
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return sendError(res, 'No files selected', 400);
  }

  // Validate bucket name
  const bucketName = bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  // Validate all paths
  const validatedPaths = [];
  for (const filePath of paths) {
    const pathValidation = validateStoragePath(filePath);
    if (!pathValidation.valid) {
      return sendError(res, `Invalid path: ${pathValidation.error}`, 400);
    }
    validatedPaths.push(pathValidation.sanitized);
  }

  try {
    const result = await deleteFiles(supabase, validatedPaths, bucketName);
    sendSuccess(res, {
      message: `Successfully deleted ${result.count} files`,
      count: result.count
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    sendError(res, error.message || 'Failed to delete files', 500);
  }
}

export default withAuth(handler);
