import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { validateBucketName, validateStoragePath, validateFilename, validateFileType } from './security.js';
import { uploadFile } from './storageOperations.js';

const sessions = new Map();
const locks = new Map();

export const DEFAULT_MAX_APPEND_BYTES = Number(process.env.RESUMABLE_APPEND_MAX_BYTES || (6 * 1024 * 1024));

function withSessionLock(sessionId, fn) {
  const previous = locks.get(sessionId) || Promise.resolve();
  const next = previous.then(fn);
  const queued = next.catch(() => {});
  locks.set(sessionId, queued.finally(() => {
    if (locks.get(sessionId) === queued) locks.delete(sessionId);
  }));
  return next;
}

function makeTempFilePath(sessionId, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(os.tmpdir(), `resumable-${sessionId}-${safeName}`);
}

export function createSession({ userId, bucket, storagePath, filename, totalSize }) {
  const bucketValidation = validateBucketName(bucket);
  if (!bucketValidation.valid) throw new Error(bucketValidation.error);

  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.valid) throw new Error(filenameValidation.error);

  const pathValidation = validateStoragePath(storagePath || filename);
  if (!pathValidation.valid) throw new Error(pathValidation.error);

  if (!Number.isFinite(Number(totalSize)) || Number(totalSize) <= 0) {
    throw new Error('totalSize must be a positive number');
  }

  const sessionId = crypto.randomUUID();
  const tempFilePath = makeTempFilePath(sessionId, filenameValidation.sanitized);

  fs.writeFileSync(tempFilePath, Buffer.alloc(0));

  const session = {
    sessionId,
    userId,
    bucket,
    storagePath: pathValidation.sanitized,
    filename: filenameValidation.sanitized,
    totalSize: Number(totalSize),
    tempFilePath,
    createdAt: Date.now(),
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export async function appendBufferToSession(sessionId, buffer, expectedOffset) {
  return withSessionLock(sessionId, async () => {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    const stats = await fs.promises.stat(session.tempFilePath);
    const currentOffset = stats.size;

    if (Number(expectedOffset) !== currentOffset) {
      throw Object.assign(new Error('Offset mismatch'), {
        statusCode: 409,
        currentOffset,
      });
    }

    await fs.promises.appendFile(session.tempFilePath, buffer);

    const newStats = await fs.promises.stat(session.tempFilePath);
    return {
      offset: newStats.size,
      complete: newStats.size >= session.totalSize,
    };
  });
}

export async function finalizeSession({ sessionId, supabase, maxRetries = 3, uploadFn = uploadFile }) {
  return withSessionLock(sessionId, async () => {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

    const stats = await fs.promises.stat(session.tempFilePath);
    if (stats.size !== session.totalSize) {
      throw Object.assign(new Error('Upload is incomplete'), { statusCode: 400 });
    }

    const typeValidation = await validateFileType(session.tempFilePath, session.filename);
    if (!typeValidation.valid) {
      throw Object.assign(new Error(typeValidation.error || 'Invalid file type'), { statusCode: 400 });
    }

    const result = await uploadFn(
      supabase,
      session.tempFilePath,
      session.bucket,
      session.storagePath,
      maxRetries
    );

    if (!result?.success) {
      throw Object.assign(new Error(result?.error || 'Upload failed'), { statusCode: 500 });
    }

    await fs.promises.unlink(session.tempFilePath).catch(() => {});
    sessions.delete(sessionId);

    return result;
  });
}

export async function readRequestBodyWithLimit(req, { maxBytes = DEFAULT_MAX_APPEND_BYTES } = {}) {
  const contentLengthHeader = req.headers['content-length'];
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      const err = new Error(`Append chunk exceeds maximum (${maxBytes} bytes)`);
      err.statusCode = 413;
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        const err = new Error(`Append chunk exceeds maximum (${maxBytes} bytes)`);
        err.statusCode = 413;
        req.destroy(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

export function _resetResumableSessionsForTests() {
  sessions.clear();
  locks.clear();
}
