import { validateMethod, sendError, sendSuccess } from '../../../utils/apiHelpers';
import { withAuth } from '../../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../../utils/storageClientFactory.js';
import { assertScopedObjectKey, getIntentRecord, commitIntentRecord, getIdempotentCommit, setIdempotentCommit, verifyObjectExists } from '../../../utils/directUpload.mjs';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;
  const { client: supabase } = storageResult;

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey || typeof idempotencyKey !== 'string') return sendError(res, 'Idempotency-Key header is required', 400);

  const cached = getIdempotentCommit(req.user.id, idempotencyKey);
  if (cached) return sendSuccess(res, cached);

  try {
    const { intentId, bucket, objectKey } = req.body || {};
    if (!intentId || !bucket || !objectKey) return sendError(res, 'intentId, bucket, and objectKey are required', 400);

    const intent = getIntentRecord(intentId);
    if (!intent) return sendError(res, 'Intent not found or expired', 404);
    if (intent.userId !== req.user.id) return sendError(res, 'Intent does not belong to this user', 403);

    assertScopedObjectKey(req.user, objectKey);
    if (intent.bucket !== bucket || intent.objectKey !== objectKey) return sendError(res, 'Finalize payload does not match intent', 400);

    const found = await verifyObjectExists(supabase, bucket, objectKey);
    if (!found) return sendError(res, 'Uploaded object not found', 404);

    commitIntentRecord(intentId);
    const response = { intentId, bucket, objectKey, committedAt: new Date().toISOString(), size: found.metadata?.size || null, etag: found.metadata?.eTag || null };
    setIdempotentCommit(req.user.id, idempotencyKey, response);
    return sendSuccess(res, response);
  } catch (error) {
    if (error.message?.includes('outside allowed scope')) return sendError(res, error.message, 403);
    return sendError(res, error.message || 'Failed to finalize upload', 500);
  }
}

export default withAuth(handler);
