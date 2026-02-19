import { withAuth } from '../../../../utils/authMiddleware.js';
import { sendError, sendSuccess, validateMethod } from '../../../../utils/apiHelpers.js';
import { resumableUploadManager } from '../../../../utils/resumableUploadServer.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

  const chunk = await readRawBody(req);
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
