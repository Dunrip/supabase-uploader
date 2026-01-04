# Security Documentation

This document describes all security features implemented in the Supabase File Manager.

## Security Features Overview

| Feature | Status | Location |
|---------|--------|----------|
| User Authentication | ✅ Implemented | `contexts/AuthContext.js`, `utils/authMiddleware.js` |
| Encrypted Credentials | ✅ Implemented | `utils/encryption.js` |
| JWT Verification | ✅ Implemented | `utils/authMiddleware.js` |
| Row Level Security | ✅ Implemented | `database/user_settings.sql` |
| Rate Limiting | ✅ Implemented | `middleware.js` |
| Path Traversal Protection | ✅ Implemented | `utils/security.js` |
| File Type Validation | ✅ Implemented | `utils/security.js` |
| Security Headers | ✅ Implemented | `next.config.js` |
| Environment Validation | ✅ Implemented | `utils/envValidation.js` |
| Input Sanitization | ✅ Implemented | `utils/security.js` |
| HTTP Header Escaping | ✅ Implemented | `pages/api/download.js`, `pages/api/preview.js` |

---

## User Authentication

**Location**: `contexts/AuthContext.js`, `utils/authMiddleware.js`

Uses Supabase Auth for secure email/password authentication.

### Features

- Email/password registration and login
- JWT-based session tokens
- Automatic token refresh
- Secure cookie storage
- Session persistence across page reloads

### Auth Middleware

```javascript
import { withAuth } from '../utils/authMiddleware';

// Require authentication
export default withAuth(async (req, res) => {
  const userId = req.user.id;
  // Handler code
});

// Optional authentication
export default withAuth(handler, { optional: true });
```

### Token Extraction

Tokens are extracted from (in order):
1. `Authorization: Bearer <token>` header
2. `token` query parameter (for browser-initiated requests)
3. Supabase auth cookies

---

## Encrypted Credential Storage

**Location**: `utils/encryption.js`

User Supabase API keys are encrypted before storing in the database using AES-256-GCM.

### Algorithm Details

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key Size | 256 bits (32 bytes) |
| IV Length | 16 bytes (random per encryption) |
| Auth Tag | 16 bytes |

### Encryption Flow

1. Generate random 16-byte IV
2. Encrypt plaintext with AES-256-GCM
3. Combine: `IV + AuthTag + Ciphertext`
4. Encode as Base64

### Key Management

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set in `.env`:
```env
ENCRYPTION_KEY=your-64-character-hex-key
```

### Security Properties

- **Confidentiality**: AES-256 encryption
- **Integrity**: GCM authentication tag
- **Unique IVs**: Random IV per encryption prevents pattern analysis
- **Key never exposed**: Server-side only, never sent to client

---

## Row Level Security

**Location**: `database/user_settings.sql`

PostgreSQL RLS ensures users can only access their own data.

### Policies

| Policy | Description |
|--------|-------------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` |

### Service Role Access

The server uses `service_role` key to bypass RLS after verifying JWT.

---

## Rate Limiting

**Location**: `middleware.js`

Protects against API abuse with configurable per-endpoint limits.

### Configuration

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/upload` | 20 requests | 1 minute |
| `/api/download` | 100 requests | 1 minute |
| `/api/files` | 100 requests | 1 minute |
| `/api/buckets` | 50 requests | 1 minute |
| `/api/preview` | 100 requests | 1 minute |
| Default | 100 requests | 1 minute |

### Response Headers

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Seconds until window resets
- `Retry-After`: Seconds to wait (when rate limited)

### Rate Limit Response (429)

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45
}
```

> **Note**: Uses in-memory storage. For production with multiple instances, use Redis or similar distributed store.

---

## Path Traversal Protection

**Location**: `utils/security.js`

Prevents directory traversal attacks that could access files outside the intended storage.

### Blocked Patterns

- `../` - Parent directory reference
- Absolute paths (`/path`, `C:\path`)
- URL-encoded attacks (`%2e%2e`, `%252e%252e`)
- UTF-8 overlong encoding (`%c0%ae`, `%c1%9c`)
- Null bytes (`\x00`)
- Consecutive slashes (`//`, `\\`)

### Validation Functions

```javascript
import { validateStoragePath, validateBucketName, validateFilename } from './utils/security';

// Validate storage path
const { valid, error, sanitized } = validateStoragePath(userPath);

// Validate bucket name (alphanumeric, hyphens, underscores)
const { valid, error } = validateBucketName(bucketName);

// Validate filename
const { valid, error, sanitized } = validateFilename(fileName);
```

---

## File Type Validation

**Location**: `utils/security.js`

Validates file types using magic bytes (file signatures) to prevent extension spoofing.

### Supported File Types

**Images**: JPEG, PNG, GIF, WebP, BMP, ICO, SVG
**Documents**: PDF
**Archives**: ZIP, GZIP, RAR, 7z, TAR
**Audio**: MP3, WAV, OGG, FLAC
**Video**: MP4, WebM, AVI, MKV, MOV
**Text**: JSON, TXT, HTML, CSS, JS, MD, XML, CSV

### Blocked Extensions

Executables and scripts that could pose security risks:

- **Windows**: exe, msi, dll, scr, cpl, com, pif
- **Scripts**: bat, cmd, ps1, vbs, sh, bash, php, asp, jsp, py, pl
- **Packages**: jar, war, deb, rpm, apk, dmg, pkg
- **Other**: reg, inf, lnk

### Usage

```javascript
import { validateFileType, isBlockedExtension } from './utils/security';

// Check magic bytes
const { valid, error, detectedType } = await validateFileType(filePath, filename);

// Quick extension check
const blocked = isBlockedExtension('malware.exe'); // true
```

---

## Security Headers

**Location**: `next.config.js`

HTTP security headers applied to all responses.

### Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Disable sensitive APIs |
| Content-Security-Policy | Restrictive CSP | Prevent XSS/injection |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
media-src 'self' blob:;
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

### API Route Headers

API routes have additional cache-control headers to prevent caching sensitive data:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

---

## Environment Validation

**Location**: `utils/envValidation.js`

Validates required environment variables at startup.

### Required Variables

| Variable | Validation |
|----------|------------|
| SUPABASE_URL | Must be valid HTTPS/HTTP URL |
| SUPABASE_KEY | Must be valid JWT format (3 base64url parts) |

### Optional Variables

| Variable | Default | Validation |
|----------|---------|------------|
| SUPABASE_BUCKET | `files` | - |
| MAX_RETRIES | `3` | Non-negative integer |
| LOG_FILE | `supabase-uploader.log` | - |
| ENABLE_LOGGING | `true` | true/false/1/0 |
| NODE_ENV | `development` | - |

### Usage

```javascript
import { validateEnvironmentOrExit } from './utils/envValidation';

// Validate and exit if invalid
validateEnvironmentOrExit();
```

---

## HTTP Header Escaping

**Location**: `pages/api/download.js`, `pages/api/preview.js`

Properly escapes filenames in Content-Disposition headers per RFC 5987.

### Implementation

```javascript
// Escape quotes and newlines for basic filename
const safeFileName = fileName.replace(/"/g, '\\"').replace(/\n/g, '');

// URL-encode for filename* parameter
const encodedFileName = encodeURIComponent(fileName);

// Set header with both formats for compatibility
res.setHeader('Content-Disposition',
  `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
);
```

### Handles

- Quotes in filenames: `file"name".pdf`
- Single quotes: `test's file.txt`
- Newlines and special characters
- Unicode characters

---

## HTML/JavaScript Escaping

**Location**: `utils/serverHelpers.js`, `utils/clientHelpers.js`

Escaping functions for server-side HTML generation (not currently used - React handles escaping automatically).

### Functions

| Function | Escapes | Use Case |
|----------|---------|----------|
| `escapeHtml()` | `< > & " '` | Text content |
| `escapeHtmlAttribute()` | `< > & " '` (&#39; for quotes) | HTML attributes |
| `escapeJsString()` | `\ ' " \n \r \t` | JavaScript strings |

### Current Status

- ✅ React/Next.js handles escaping automatically for JSX
- ✅ Functions available for future server-side HTML generation
- ✅ HTTP headers properly escaped in API routes

---

## Best Practices

1. **Never trust user input** - All paths, filenames, and bucket names are validated
2. **Use appropriate escaping** - Context-aware escaping for HTML, JS, and HTTP headers
3. **Fail fast** - Environment validation on startup prevents misconfiguration
4. **Defense in depth** - Multiple layers of validation (extension + magic bytes)
5. **Secure defaults** - Rate limiting, security headers, and CSP enabled by default

---

## Testing Security

Test cases for validation:

```
# Path Traversal
../../../etc/passwd          → Blocked
%2e%2e%2f                     → Blocked
..\..\windows\system32       → Blocked

# Blocked Extensions
malware.exe                   → Blocked
script.php                    → Blocked
backdoor.sh                   → Blocked

# Special Filenames
test's file.txt               → Allowed (properly escaped)
file"with"quotes.pdf          → Allowed (properly escaped)
file<script>alert.js          → Blocked (.js is blocked)

# Bucket Names
my-bucket                     → Valid
my_bucket_123                 → Valid
../hack                       → Invalid
```

---

## Known Limitations

1. **In-Memory Rate Limiter**: Not suitable for multi-instance deployments (use Redis for production clusters)
2. **JavaScript Codebase**: TypeScript types available but not enforced

See `TODO.md` for planned improvements.
