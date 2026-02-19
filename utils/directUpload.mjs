import crypto from 'crypto';
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const intentStore = new Map();
const idempotencyStore = new Map();

export function resolveTenantId(user) { return user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || 'default'; }
export function buildScopedPrefix(user) { return `tenants/${resolveTenantId(user)}/users/${user.id}/`; }

function sanitizeSegment(value, fallback = 'file') {
  return String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || fallback;
}

export function normalizeScopedObjectKey(user, objectKey, filename = 'upload.bin') {
  const prefix = buildScopedPrefix(user);
  let scoped = String(objectKey || '').replace(/^\/+/, '');
  if (!scoped) scoped = `${Date.now()}-${sanitizeSegment(filename, 'upload.bin')}`;
  if (scoped.includes('..') || scoped.includes('\\')) throw new Error('Invalid object key');
  if (!scoped.startsWith(prefix)) scoped = `${prefix}${scoped}`;
  if (!scoped.startsWith(prefix)) throw new Error('Object key must be inside scoped prefix');
  return { objectKey: scoped, prefix };
}

export function assertScopedObjectKey(user, objectKey) {
  const prefix = buildScopedPrefix(user);
  if (!String(objectKey || '').startsWith(prefix)) throw new Error('Object key outside allowed scope');
  return prefix;
}

export function createIntentRecord({ userId, bucket, objectKey, constraints, ttlMs = DEFAULT_TTL_MS }) {
  const now = Date.now();
  const intent = { intentId: crypto.randomUUID(), userId, bucket, objectKey, constraints, state: 'pending', createdAt: now, expiresAt: now + ttlMs };
  intentStore.set(intent.intentId, intent);
  return intent;
}

export function getIntentRecord(intentId) {
  const intent = intentStore.get(intentId);
  if (!intent) return null;
  if (intent.expiresAt <= Date.now()) { intentStore.delete(intentId); return null; }
  return intent;
}

export function commitIntentRecord(intentId) {
  const intent = getIntentRecord(intentId);
  if (!intent) throw new Error('Intent not found or expired');
  if (intent.state !== 'committed') { intent.state = 'committed'; intent.committedAt = Date.now(); intentStore.set(intentId, intent); }
  return intent;
}

export function getIdempotentCommit(userId, idempotencyKey) {
  const key = `${userId}:${idempotencyKey}`;
  const entry = idempotencyStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { idempotencyStore.delete(key); return null; }
  return entry.response;
}

export function setIdempotentCommit(userId, idempotencyKey, response, ttlMs = DEFAULT_TTL_MS) {
  idempotencyStore.set(`${userId}:${idempotencyKey}`, { response, expiresAt: Date.now() + ttlMs });
}

export async function verifyObjectExists(supabase, bucket, objectKey) {
  const parts = objectKey.split('/');
  const fileName = parts.pop();
  const folder = parts.join('/');
  const { data, error } = await supabase.storage.from(bucket).list(folder, { search: fileName, limit: 100 });
  if (error) throw new Error(error.message || 'Failed to verify uploaded object');
  return (data || []).find((item) => item.name === fileName) || null;
}

export function __resetDirectUploadStoresForTests() { intentStore.clear(); idempotencyStore.clear(); }
