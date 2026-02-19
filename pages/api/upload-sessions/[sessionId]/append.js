import { withAuth } from '../../../../utils/authMiddleware.js';
import { sendError, sendSuccess, validateMethod } from '../../../../utils/apiHelpers.js';
import { resumableUploadManager, MAX_APPEND_CHUNK_BYTES } from '../../../../utils/resumableUploadServer.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_APPEND_CHUNK_BYTES) {
    const error = new Error(`Chunk exceeds maximum size (${MAX_APPEND_CHUNK_BYTES} bytes)`);
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const normalized = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += normalized.length;
    if (total > MAX_APPEND_CHUNK_BYTES) {
      const error = new Error(`Chunk exceeds maximum size (${MAX_APPEND_CHUNK_BYTES} bytes)`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(normalized);
  }
  return Buffer.concat(chunks);
}

async function handler(req, res) {
  if (!validateMethod(req, res, ['PATCH', 'GET'])) return;

  const { sessionId } = req.query;

  if (req.method === 'GET') {
    const session = await resumableUploadManager.getSession(sessionId, req.user.id);
    if (!session) {
      return sendError(res, 'Session not found', 404);
    }

    return sendSuccess(res, {
      session,
      nextOffset: session.uploadedBytes,
    });
  }

  const offset = Number(req.headers['upload-offset'] ?? req.headers['x-upload-offset'] ?? req.query.offset ?? -1);
  if (!Number.isInteger(offset) || offset < 0) {
    return sendError(res, 'Valid upload offset is required', 400);
  }

  let chunk;
  try {
    chunk = await readRawBody(req);
  } catch (error) {
    return sendError(res, error.message || 'Invalid chunk payload', error.statusCode || 400);
  }

  const chunkSha256 = req.headers['x-chunk-sha256'];

  const result = await resumableUploadManager.appendChunk({
    sessionId,
    userId: req.user.id,
    offset,
    chunk,
    chunkSha256: typeof chunkSha256 === 'string' ? chunkSha256 : null,
  });

  if (!result.success) {
    return sendError(res, result.error, result.status || 400, {
      expectedOffset: result.expectedOffset,
      uploadedBytes: result.uploadedBytes,
    });
  }

  return sendSuccess(res, {
    session: result.session,
    uploadedBytes: result.uploadedBytes,
    nextOffset: result.uploadedBytes,
    completed: result.completed,
  });
}

export default withAuth(handler, { skipCsrf: true });
