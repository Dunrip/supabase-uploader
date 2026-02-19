import path from 'path';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
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

  const { sourcePath, destinationFolder, bucket } = req.body;

  // Validate source path
  if (!sourcePath) {
    return sendError(res, 'Source path is required', 400);
  }

  const sourceValidation = validateStoragePath(sourcePath);
  if (!sourceValidation.valid) {
    return sendError(res, sourceValidation.error, 400);
  }

  // Validate destination folder (can be empty string for root)
  let sanitizedDestFolder = '';
  if (destinationFolder && destinationFolder !== '/') {
    const destValidation = validateStoragePath(destinationFolder);
    if (!destValidation.valid) {
      return sendError(res, destValidation.error, 400);
    }
    sanitizedDestFolder = destValidation.sanitized;
  }

  // Validate bucket
  const bucketName = bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  const sanitizedSourcePath = sourceValidation.sanitized;
  const fileName = path.basename(sanitizedSourcePath);

  // Build destination path
  const destinationPath = sanitizedDestFolder
    ? `${sanitizedDestFolder}/${fileName}`
    : fileName;

  // Check if source and destination are the same
  if (sanitizedSourcePath === destinationPath) {
    return sendError(res, 'Source and destination are the same', 400);
  }

  try {

    // Check if file with same name already exists at destination
    const destFolder = sanitizedDestFolder || '';
    const { data: existingFiles } = await supabase.storage
      .from(bucketName)
      .list(destFolder, { limit: 1, search: fileName });

    if (existingFiles && existingFiles.some(f => f.name === fileName)) {
      return sendError(res, 'A file with this name already exists at the destination', 409);
    }

    // Use Supabase native move operation
    const { error: moveError } = await supabase.storage
      .from(bucketName)
      .move(sanitizedSourcePath, destinationPath);

    if (moveError) {
      console.error('Move error:', moveError);
      // Handle missing file error
      if (moveError.statusCode === '404' || moveError.message?.includes('not found')) {
        return sendError(res, 'Source file not found', 404);
      }
      return sendError(res, moveError.message || 'Failed to move file', 500);
    }

    return sendSuccess(res, {
      message: 'File moved successfully',
      sourcePath: sanitizedSourcePath,
      destinationPath: destinationPath,
    });
  } catch (error) {
    console.error('Move error:', error);
    return sendError(res, error.message || 'Failed to move file', 500);
  }
}

export default withAuth(handler);
