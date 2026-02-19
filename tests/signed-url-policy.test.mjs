import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSignedUrlPolicyConfig,
  resolveSignedUrlTtl,
  resolveAllowedPrefixes,
  isObjectKeyAllowed,
} from '../utils/signedUrlPolicy.mjs';

test('happy path: default TTL and root object key are allowed by default policy', () => {
  const config = getSignedUrlPolicyConfig({
    SIGNED_URL_TTL_DEFAULT: '60',
    SIGNED_URL_TTL_MIN: '30',
    SIGNED_URL_TTL_MAX: '300',
  });

  const ttl = resolveSignedUrlTtl(undefined, config);
  assert.equal(ttl.valid, true);
  assert.equal(ttl.ttl, 60);

  const prefixes = resolveAllowedPrefixes('user-123', config);
  assert.deepEqual(prefixes, ['*']);
  assert.equal(isObjectKeyAllowed('report.pdf', prefixes), true);
  assert.equal(isObjectKeyAllowed('user-123/docs/a.pdf', prefixes), true);
});

test('denied: object key outside allowed scope is rejected', () => {
  const config = getSignedUrlPolicyConfig({
    SIGNED_URL_ALLOWED_PREFIXES: '{userId}/private/',
  });

  const prefixes = resolveAllowedPrefixes('user-123', config);
  assert.equal(isObjectKeyAllowed('user-123/public/a.pdf', prefixes), false);
  assert.equal(isObjectKeyAllowed('other-user/private/a.pdf', prefixes), false);
});

test('invalid TTL: below minimum is rejected', () => {
  const config = getSignedUrlPolicyConfig({
    SIGNED_URL_TTL_MIN: '30',
    SIGNED_URL_TTL_MAX: '300',
  });

  const ttl = resolveSignedUrlTtl('29', config);
  assert.equal(ttl.valid, false);
  assert.match(ttl.error, /between 30 and 300/);
});

test('expired/overlong TTL: above maximum is rejected', () => {
  const config = getSignedUrlPolicyConfig({
    SIGNED_URL_TTL_MIN: '30',
    SIGNED_URL_TTL_MAX: '300',
  });

  const ttl = resolveSignedUrlTtl('301', config);
  assert.equal(ttl.valid, false);
  assert.match(ttl.error, /between 30 and 300/);
});
