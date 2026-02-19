const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('auth middleware has quota + RBAC baseline hooks', () => {
  const src = read('utils/authMiddleware.js');
  assert.match(src, /enforceRequestQuota/);
  assert.match(src, /rolesAllowed/);
  assert.match(src, /getUserRole/);
});

test('sensitive mutation endpoints enforce operator role', () => {
  for (const rel of ['pages/api/files.js', 'pages/api/folders.js', 'pages/api/move.js', 'pages/api/rename.js', 'pages/api/bulk-delete.js']) {
    const src = read(rel);
    assert.match(src, /enforceRole\(req, res, 'operator'\)/, `${rel} missing operator role gate`);
  }
});

test('audit endpoint exists and protected', () => {
  const src = read('pages/api/audit.js');
  assert.match(src, /queryAuditEvents/);
  assert.match(src, /rolesAllowed:\s*\['operator',\s*'admin'\]/);
});
