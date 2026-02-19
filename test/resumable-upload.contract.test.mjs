import test from 'node:test';
import assert from 'node:assert/strict';
import { ResumableUploadManager } from '../utils/resumableUploadServer.js';

function createMockSupabase() {
  return {
    storage: {
      from() {
        return {
          async upload(path, data) {
            return {
              data: { id: 'file-id', path },
              error: null,
            };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `https://example.com/${path}` } };
          },
        };
      },
    },
  };
}

test('contract: interrupted upload can resume and complete', async () => {
  const manager = new ResumableUploadManager();
  await manager.init();

  const payload = Buffer.from('hello resumable world');
  const session = await manager.createSession({
    userId: 'user-1',
    bucket: 'files',
    storagePath: 'docs/test.txt',
    fileName: 'test.txt',
    totalSize: payload.length,
    chunkSize: 5,
  });

  const first = await manager.appendChunk({
    sessionId: session.id,
    userId: 'user-1',
    offset: 0,
    chunk: payload.subarray(0, 5),
  });
  assert.equal(first.success, true);
  assert.equal(first.uploadedBytes, 5);

  const interrupted = await manager.appendChunk({
    sessionId: session.id,
    userId: 'user-1',
    offset: 0,
    chunk: payload.subarray(0, 5),
  });
  assert.equal(interrupted.status, 409);
  assert.equal(interrupted.expectedOffset, 5);

  const resumed = await manager.appendChunk({
    sessionId: session.id,
    userId: 'user-1',
    offset: 5,
    chunk: payload.subarray(5),
  });
  assert.equal(resumed.success, true);
  assert.equal(resumed.completed, true);

  const completed = await manager.completeSession({
    sessionId: session.id,
    userId: 'user-1',
    supabase: createMockSupabase(),
    maxRetries: 1,
  });

  assert.equal(completed.success, true);
  assert.equal(completed.uploadedBytes, payload.length);
});

test('contract: expired sessions are rejected', async () => {
  const manager = new ResumableUploadManager();
  await manager.init();

  const session = await manager.createSession({
    userId: 'user-1',
    bucket: 'files',
    storagePath: 'docs/expired.bin',
    fileName: 'expired.bin',
    totalSize: 3,
    chunkSize: 3,
  });

  manager.sessions.get(session.id).expiresAt = Date.now() - 1;

  const result = await manager.appendChunk({
    sessionId: session.id,
    userId: 'user-1',
    offset: 0,
    chunk: Buffer.from('abc'),
  });

  assert.equal(result.status, 410);
});
