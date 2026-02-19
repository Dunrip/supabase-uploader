import crypto from 'crypto';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createWebhookSignature({ secret, timestamp, payload }) {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}`;
}

export function verifyWebhookSignature({ secret, timestamp, payload, signature }) {
  const expected = createWebhookSignature({ secret, timestamp, payload });
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function deliverWebhook(event, options) {
  const { endpoint, secret, maxRetries = 3, baseDelayMs = 500, timeoutMs = 10000, fetchImpl = fetch, logger = console } = options;
  const payload = JSON.stringify(event);

  for (let attempts = 1; attempts <= maxRetries; attempts++) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createWebhookSignature({ secret, timestamp, payload });
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return { delivered: true, attempts };
      logger.warn?.(`[Webhook] attempt ${attempts} failed status=${response.status}`);
    } catch (error) {
      logger.warn?.(`[Webhook] attempt failed: ${error.message}`);
    }
    if (attempts < maxRetries) await sleep(baseDelayMs * (2 ** (attempts - 1)));
    if (attempts === maxRetries) {
      logger.error?.(`[Webhook] Retry exhausted for event ${event.id}`);
      return { delivered: false, attempts };
    }
  }
}

export async function emitUploadEvent(type, data, options = {}) {
  const endpoint = options.endpoint || process.env.WEBHOOK_URL;
  const secret = options.secret || process.env.WEBHOOK_SECRET;
  if (!endpoint || !secret) return { delivered: false, skipped: true };

  const event = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  return deliverWebhook(event, {
    endpoint,
    secret,
    maxRetries: Number(options.maxRetries || process.env.WEBHOOK_MAX_RETRIES || 3),
    baseDelayMs: Number(options.baseDelayMs || process.env.WEBHOOK_BASE_DELAY_MS || 500),
    timeoutMs: Number(options.timeoutMs || process.env.WEBHOOK_TIMEOUT_MS || 10000),
    logger: options.logger || console,
    fetchImpl: options.fetchImpl || fetch,
  });
}
