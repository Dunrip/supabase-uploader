import { withAuth } from '../../../../utils/authMiddleware.js';
import { sendError, sendSuccess, validateMethod } from '../../../../utils/apiHelpers.js';
import { createStorageClientWithErrorHandling } from '../../../../utils/storageClientFactory.js';
import { resumableUploadManager } from '../../../../utils/resumableUploadServer.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { sessionId } = req.query;

  const result = await resumableUploadManager.completeSession({
    sessionId,
    userId: req.user.id,
    supabase: storageResult.client,
    maxRetries: storageResult.settings.max_retries,
  });

  if (!result.success) {
    return sendError(res, result.error, result.status || 400, {
      uploadedBytes: result.uploadedBytes,
      totalSize: result.totalSize,
    });
  }

  return sendSuccess(res, {
    sessionId: result.sessionId,
    uploadedBytes: result.uploadedBytes,
    bucket: result.bucket,
    path: result.storagePath,
    result: result.result,
  });
}

export default withAuth(handler);
