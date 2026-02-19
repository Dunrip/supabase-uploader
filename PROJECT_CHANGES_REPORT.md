# Project Changes Report

## Issue #17 — Sprint: Remediate production dependency vulnerabilities

### Scope
Remediated production dependency vulnerabilities in `next` and transitive `glob/minimatch` chain while keeping changes focused to dependency/security updates.

### Dependency changes
- Updated `next` from `^14.0.0` → `^15.5.12`
- Added `overrides`:
  - `glob`: `^10.5.0`
  - `minimatch`: `^10.2.1`

### Validation run
- `npm install` ✅
- `npm audit --omit=dev --audit-level=high` ✅ (no high/critical findings)
- `npm run test` ⚠️ failed because project has no `test` script defined
- `npm run build` ✅ successful on Next.js 15.5.12

### Residual risk
- No **high** or **critical** production vulnerabilities remain.
- One **moderate** advisory remains (`lodash`, GHSA-xxjr-mmjv-4gpg) via transitive dependency chain.

### Mitigations for residual advisory
- Keep lockfile pinned and monitor upstream package updates.
- Re-run `npm audit --omit=dev` in CI on each dependency update.
- Plan targeted follow-up to remove/upgrade transitive lodash consumer when compatible versions are available.
