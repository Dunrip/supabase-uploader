const DEFAULT_SIGNED_URL_TTL = 60;
const DEFAULT_SIGNED_URL_TTL_MIN = 30;
const DEFAULT_SIGNED_URL_TTL_MAX = 300;
const DEFAULT_ALLOWED_PREFIX_TEMPLATE = '{userId}/';

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSignedUrlPolicyConfig(env = process.env) {
  const minTtl = parsePositiveInt(env.SIGNED_URL_TTL_MIN, DEFAULT_SIGNED_URL_TTL_MIN);
  const maxTtl = parsePositiveInt(env.SIGNED_URL_TTL_MAX, DEFAULT_SIGNED_URL_TTL_MAX);

  // If misconfigured, normalize to secure defaults.
  const normalizedMin = Math.min(minTtl, maxTtl);
  const normalizedMax = Math.max(minTtl, maxTtl);

  const requestedDefault = parsePositiveInt(env.SIGNED_URL_TTL_DEFAULT, DEFAULT_SIGNED_URL_TTL);
  const defaultTtl = Math.min(Math.max(requestedDefault, normalizedMin), normalizedMax);

  const rawPrefixes = (env.SIGNED_URL_ALLOWED_PREFIXES || DEFAULT_ALLOWED_PREFIX_TEMPLATE)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const allowedPrefixTemplates = rawPrefixes.length > 0 ? rawPrefixes : [DEFAULT_ALLOWED_PREFIX_TEMPLATE];

  return {
    minTtl: normalizedMin,
    maxTtl: normalizedMax,
    defaultTtl,
    allowedPrefixTemplates,
  };
}

export function resolveSignedUrlTtl(rawTtl, config) {
  if (rawTtl === undefined || rawTtl === null || rawTtl === '') {
    return { valid: true, ttl: config.defaultTtl };
  }

  const ttl = Number.parseInt(rawTtl, 10);
  if (!Number.isInteger(ttl)) {
    return { valid: false, error: 'ttl must be an integer (seconds)' };
  }

  if (ttl < config.minTtl || ttl > config.maxTtl) {
    return {
      valid: false,
      error: `ttl must be between ${config.minTtl} and ${config.maxTtl} seconds`,
    };
  }

  return { valid: true, ttl };
}

export function resolveAllowedPrefixes(userId, config) {
  const safeUserId = String(userId || '').trim();

  return config.allowedPrefixTemplates
    .map((template) => template.replaceAll('{userId}', safeUserId))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isObjectKeyAllowed(objectKey, allowedPrefixes = []) {
  const key = String(objectKey || '').trim();
  if (!key || allowedPrefixes.length === 0) return false;

  return allowedPrefixes.some((prefix) => {
    if (prefix === '*') return true;
    if (key === prefix) return true;
    return key.startsWith(prefix);
  });
}
