import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebhookSignature, verifyWebhookSignature, deliverWebhook } from '../utils/eventPipeline.mjs';

test('signature roundtrip works and rejects tampered payload', () => {
  const secret = 'top-secret';
  const timestamp = '1700000000';
  const payload = JSON.stringify({ hello: 'world' });
  const signature = createWebhookSignature({ secret, timestamp, payload });

  assert.equal(verifyWebhookSignature({ secret, timestamp, payload, signature }), true);
  assert.equal(verifyWebhookSignature({ secret, timestamp, payload: JSON.stringify({ hello: 'tampered' }), signature }), false);
});

test('webhook retries and succeeds', async () => {
  let calls = 0;
  const result = await deliverWebhook(
    { id: 'evt_1', type: 'upload.completed', timestamp: new Date().toISOString(), data: {} },
    {
      endpoint: 'https://example.com/webhook',
      secret: 'test-secret',
      maxRetries: 3,
      baseDelayMs: 1,
      fetchImpl: async () => {
        calls += 1;
        if (calls < 3) throw new Error('temporary error');
        return { ok: true, status: 200 };
      },
      logger: { warn: () => {}, error: () => {} },
    }
  );

  assert.equal(result.delivered, true);
  assert.equal(result.attempts, 3);
});

test('webhook retry exhausted path logs error', async () => {
  const logs = [];
  const result = await deliverWebhook(
    { id: 'evt_2', type: 'upload.failed', timestamp: new Date().toISOString(), data: {} },
    {
      endpoint: 'https://example.com/webhook',
      secret: 'test-secret',
      maxRetries: 2,
      baseDelayMs: 1,
      fetchImpl: async () => ({ ok: false, status: 500 }),
      logger: { warn: () => {}, error: (msg) => logs.push(msg) },
    }
  );

  assert.equal(result.delivered, false);
  assert.equal(logs.some((l) => l.includes('Retry exhausted')), true);
});
