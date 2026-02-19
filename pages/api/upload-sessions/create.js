import { withAuth } from '../../../utils/authMiddleware.js';
import { sendError, sendSuccess, validateMethod } from '../../../utils/apiHelpers.js';
import { validateStoragePath, validateBucketName, validateFilename } from '../../../utils/security.js';
import { createStorageClientWithErrorHandling } from '../../../utils/storageClientFactory.js';
import { resumableUploadManager } from '../../../utils/resumableUploadServer.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  try {
    const {
      bucket,
      path,
      fileName,
      totalSize,
      chunkSize,
      fileSha256,
      expiresInSeconds,
    } = req.body || {};

    const bucketValidation = validateBucketName(bucket || storageResult.settings.default_bucket || 'files');
    if (!bucketValidation.valid) {
      return sendError(res, bucketValidation.error, 400);
    }

    const fileNameValidation = validateFilename(fileName || 'upload.bin');
    if (!fileNameValidation.valid) {
      return sendError(res, fileNameValidation.error, 400);
    }

    const resolvedPath = path || fileName;
    const pathValidation = validateStoragePath(resolvedPath || 'upload.bin');
    if (!pathValidation.valid) {
      return sendError(res, pathValidation.error, 400);
    }

    const session = await resumableUploadManager.createSession({
      userId: req.user.id,
      bucket: (bucket || storageResult.settings.default_bucket || 'files').trim(),
      storagePath: pathValidation.sanitized,
      fileName: fileName || pathValidation.sanitized.split('/').pop(),
      totalSize: Number(totalSize),
      chunkSize: Number(chunkSize),
      fileSha256,
      expiresInSeconds,
    });

    return sendSuccess(res, {
      session,
      uploadId: session.id,
      nextOffset: 0,
    }, 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create upload session', 400);
  }
}

export default withAuth(handler);
