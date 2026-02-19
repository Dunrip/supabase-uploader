import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScopedObjectKey, createIntentRecord, getIntentRecord, setIdempotentCommit, getIdempotentCommit, __resetDirectUploadStoresForTests } from '../utils/directUpload.mjs';

const user = { id: 'user-123', app_metadata: { tenant_id: 'tenant-abc' } };

test.beforeEach(() => __resetDirectUploadStoresForTests());

test('happy path: normalizes scoped key and stores intent', () => {
  const { objectKey, prefix } = normalizeScopedObjectKey(user, 'docs/readme.md', 'readme.md');
  assert.equal(prefix, 'tenants/tenant-abc/users/user-123/');
  assert.equal(objectKey, 'tenants/tenant-abc/users/user-123/docs/readme.md');
  const intent = createIntentRecord({ userId: user.id, bucket: 'files', objectKey, constraints: { contentLength: 1024 } });
  assert.equal(getIntentRecord(intent.intentId)?.bucket, 'files');
});

test('invalid scope: rejects traversal-style key', () => {
  assert.throws(() => normalizeScopedObjectKey(user, '../secrets.txt', 'secrets.txt'), /Invalid object key/);
});

test('replay/idempotency: same key returns same cached response', () => {
  const response = { intentId: 'intent-1', bucket: 'files', objectKey: 'tenants/tenant-abc/users/user-123/docs/readme.md' };
  setIdempotentCommit(user.id, 'idem-001', response);
  assert.deepEqual(getIdempotentCommit(user.id, 'idem-001'), response);
});
