import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import {
  createSession,
  appendBufferToSession,
  finalizeSession,
  readRequestBodyWithLimit,
  _resetResumableSessionsForTests,
} from '../utils/resumableSessions.js';

function makeReqFromBuffer(buffer, headers = {}) {
  const req = new Readable({ read() {} });
  req.headers = headers;
  req.push(buffer);
  req.push(null);
  return req;
}

test.beforeEach(() => {
  _resetResumableSessionsForTests();
});

test('complete/finalize enforces file type validation (blocked extension)', async () => {
  const session = createSession({
    userId: 'u1',
    bucket: 'files',
    storagePath: 'malware.exe',
    filename: 'malware.exe',
    totalSize: 4,
  });

  await appendBufferToSession(session.sessionId, Buffer.from([1, 2, 3, 4]), 0);

  await assert.rejects(
    () => finalizeSession({ sessionId: session.sessionId, supabase: {}, uploadFn: async () => ({ success: true }) }),
    /not allowed|Invalid file type/i
  );
});

test('append request rejects oversize payload early via content-length', async () => {
  const req = makeReqFromBuffer(Buffer.from('abc'), {
    'content-length': String(11),
  });

  await assert.rejects(
    () => readRequestBodyWithLimit(req, { maxBytes: 10 }),
    (err) => err && err.statusCode === 413
  );
});

test('append request rejects oversize payload during streaming', async () => {
  const req = makeReqFromBuffer(Buffer.alloc(11, 1), {
    'content-length': String(11),
  });

  await assert.rejects(
    () => readRequestBodyWithLimit(req, { maxBytes: 10 }),
    (err) => err && err.statusCode === 413
  );
});

test('concurrent appends are serialized and offset check/write is atomic', async () => {
  const session = createSession({
    userId: 'u1',
    bucket: 'files',
    storagePath: 'safe.txt',
    filename: 'safe.txt',
    totalSize: 6,
  });

  const p1 = appendBufferToSession(session.sessionId, Buffer.from('abc'), 0);
  const p2 = appendBufferToSession(session.sessionId, Buffer.from('xyz'), 0);

  const [r1, r2] = await Promise.allSettled([p1, p2]);
  const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
  const rejected = [r1, r2].filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason.message, /Offset mismatch/);
});
