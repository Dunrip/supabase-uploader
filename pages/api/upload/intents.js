import { validateMethod, sendError, sendSuccess } from '../../../utils/apiHelpers';
import { withAuth } from '../../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../../utils/storageClientFactory.js';
import { normalizeScopedObjectKey, createIntentRecord } from '../../../utils/directUpload.mjs';

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;
  const { client: supabase, settings } = storageResult;

  try {
    const { bucket, objectKey, filename, contentType, contentLength } = req.body || {};
    const bucketName = bucket || settings.default_bucket || 'files';
    const maxBytes = Number(process.env.DIRECT_UPLOAD_MAX_BYTES || DEFAULT_MAX_BYTES);
    if (!contentLength || Number(contentLength) <= 0) return sendError(res, 'contentLength is required', 400);
    if (Number(contentLength) > maxBytes) return sendError(res, `contentLength exceeds maximum (${maxBytes})`, 400);

    const { objectKey: scopedObjectKey, prefix } = normalizeScopedObjectKey(req.user, objectKey, filename);
    const allowedMimeRegex = process.env.DIRECT_UPLOAD_ALLOWED_MIME_REGEX || '.*';
    if (contentType && !(new RegExp(allowedMimeRegex)).test(contentType)) return sendError(res, 'contentType is not allowed', 400);

    const intent = createIntentRecord({
      userId: req.user.id,
      bucket: bucketName,
      objectKey: scopedObjectKey,
      constraints: { maxBytes, contentLength: Number(contentLength), contentType: contentType || 'application/octet-stream', allowedMimeRegex },
    });

    const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(scopedObjectKey);
    if (error) return sendError(res, error.message || 'Failed to create signed upload url', 500);

    return sendSuccess(res, { intent: { intentId: intent.intentId, bucket: bucketName, objectKey: scopedObjectKey, prefix, expiresAt: new Date(intent.expiresAt).toISOString(), constraints: intent.constraints }, upload: data }, 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create upload intent', 500);
  }
}

export default withAuth(handler);
