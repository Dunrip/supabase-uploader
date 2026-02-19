import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getTempDir } from './serverHelpers.js';
import { uploadFile } from './storageOperations.js';

const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour
const MAX_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

export class ResumableUploadManager {
  constructor() {
    this.sessions = new Map();
  }

  async init() {
    const tempDir = await getTempDir();
    this.baseDir = path.join(tempDir, 'resumable-sessions');
    await fs.promises.mkdir(this.baseDir, { recursive: true });
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        await this.deleteSessionFiles(session);
        this.sessions.delete(id);
      }
    }
  }

  async createSession({ userId, bucket, storagePath, totalSize, chunkSize, fileName, fileSha256, expiresInSeconds }) {
    if (!this.baseDir) await this.init();
    await this.cleanupExpiredSessions();

    if (!Number.isInteger(totalSize) || totalSize <= 0) {
      throw new Error('totalSize must be a positive integer');
    }

    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error('chunkSize must be a positive integer');
    }

    const ttlSeconds = Math.min(Math.max(Number(expiresInSeconds) || DEFAULT_EXPIRY_SECONDS, 60), MAX_EXPIRY_SECONDS);
    const id = crypto.randomUUID();
    const tempFilePath = path.join(this.baseDir, `${id}.part`);

    await fs.promises.writeFile(tempFilePath, Buffer.alloc(0));

    const now = Date.now();
    const session = {
      id,
      userId,
      bucket,
      storagePath,
      fileName,
      totalSize,
      chunkSize,
      uploadedBytes: 0,
      fileSha256: fileSha256 || null,
      tempFilePath,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };

    this.sessions.set(id, session);
    return this.serialize(session);
  }

  async getSession(sessionId, userId) {
    if (!this.baseDir) await this.init();
    await this.cleanupExpiredSessions();

    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;

    if (session.expiresAt <= Date.now()) {
      await this.deleteSessionFiles(session);
      this.sessions.delete(sessionId);
      return null;
    }

    return this.serialize(session);
  }

  async appendChunk({ sessionId, userId, offset, chunk, chunkSha256 }) {
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
      throw new Error('chunk payload is required');
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return { error: 'Session not found', status: 404 };
    }

    if (session.expiresAt <= Date.now()) {
      await this.deleteSessionFiles(session);
      this.sessions.delete(sessionId);
      return { error: 'Upload session expired', status: 410 };
    }

    if (session.status !== 'active') {
      return { error: `Session is ${session.status}`, status: 409 };
    }

    if (offset !== session.uploadedBytes) {
      return {
        error: 'Offset mismatch',
        status: 409,
        expectedOffset: session.uploadedBytes,
        uploadedBytes: session.uploadedBytes,
      };
    }

    if (chunkSha256) {
      const actual = crypto.createHash('sha256').update(chunk).digest('hex');
      if (actual !== chunkSha256) {
        return { error: 'Chunk checksum mismatch', status: 422 };
      }
    }

    if (session.uploadedBytes + chunk.length > session.totalSize) {
      return { error: 'Chunk exceeds declared file size', status: 400 };
    }

    await fs.promises.appendFile(session.tempFilePath, chunk);

    session.uploadedBytes += chunk.length;
    session.lastActivityAt = Date.now();

    return {
      success: true,
      session: this.serialize(session),
      uploadedBytes: session.uploadedBytes,
      completed: session.uploadedBytes === session.totalSize,
    };
  }

  async completeSession({ sessionId, userId, supabase, maxRetries = 3 }) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return { error: 'Session not found', status: 404 };
    }

    if (session.expiresAt <= Date.now()) {
      await this.deleteSessionFiles(session);
      this.sessions.delete(sessionId);
      return { error: 'Upload session expired', status: 410 };
    }

    if (session.uploadedBytes !== session.totalSize) {
      return {
        error: 'Upload is incomplete',
        status: 409,
        uploadedBytes: session.uploadedBytes,
        totalSize: session.totalSize,
      };
    }

    if (session.fileSha256) {
      const actualHash = await this.hashFile(session.tempFilePath);
      if (actualHash !== session.fileSha256) {
        return { error: 'Final file checksum mismatch', status: 422 };
      }
    }

    session.status = 'finalizing';

    const result = await uploadFile(
      supabase,
      session.tempFilePath,
      session.bucket,
      session.storagePath,
      maxRetries
    );

    if (!result?.success) {
      session.status = 'active';
      return { error: result?.error || 'Finalize upload failed', status: 502 };
    }

    session.status = 'completed';
    await this.deleteSessionFiles(session);
    this.sessions.delete(sessionId);

    return {
      success: true,
      sessionId,
      storagePath: session.storagePath,
      bucket: session.bucket,
      uploadedBytes: session.totalSize,
      result,
    };
  }

  async deleteSessionFiles(session) {
    if (!session?.tempFilePath) return;
    try {
      await fs.promises.unlink(session.tempFilePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed deleting resumable temp file:', error.message);
      }
    }
  }

  async hashFile(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  serialize(session) {
    return {
      id: session.id,
      bucket: session.bucket,
      storagePath: session.storagePath,
      fileName: session.fileName,
      totalSize: session.totalSize,
      chunkSize: session.chunkSize,
      uploadedBytes: session.uploadedBytes,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
    };
  }
}

export const resumableUploadManager = new ResumableUploadManager();
export { DEFAULT_EXPIRY_SECONDS, MAX_EXPIRY_SECONDS };
