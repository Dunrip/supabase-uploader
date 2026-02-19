<div align="center">

# 📦 Supabase File Manager

**Multi-user file management platform for Supabase Storage**

A beautiful dark-themed web interface for managing files in Supabase Storage. Each user can connect their own Supabase project with encrypted credential storage.

---

</div>

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#1-installation)
  - [Set Up Auth Project](#2-set-up-auth-project)
  - [Configure Environment](#3-configure-environment)
  - [Run the Application](#4-run-the-application)
- [Web Interface Guide](#-web-interface-guide)
- [CLI Usage](#-cli-usage)
- [Using as a Module](#-using-as-a-module)
- [Configuration](#-configuration)
- [Webhook Consumer Guide](#-webhook-consumer-guide)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## ✨ Features

- 🔐 **Multi-User Authentication** - Email/password auth with secure session management
- 🌐 **Per-User Supabase Connection** - Each user connects their own Supabase project
- 🔒 **Encrypted API Keys** - User credentials encrypted with AES-256-GCM at rest
- 📤 **Upload Files** - Drag & drop with progress tracking and folder support
- 🔁 **Resumable Upload Sessions (MVP)** - Create/append/complete flow for retry-safe large uploads
- 📋 **File Management** - List, preview, download, rename, and delete files
- 📁 **Folder Organization** - Create folders, move files, breadcrumb navigation
- 🔍 **Search & Filter** - Find files by name, filter by type, sort by date/size/name
- ✅ **Bulk Operations** - Select multiple files for download (ZIP) or delete
- 📄 **File Preview** - Preview images, videos, PDFs, and audio files
- 📊 **Activity Logs** - View application logs in real-time
- 📱 **Mobile Responsive** - Touch-friendly UI with 44px targets
- ⚙️ **CLI Tool** - Command-line interface for automation

## 🏗️ Architecture

This application uses a **two-project architecture**:

1. **Auth Project** - A central Supabase project for:
   - User authentication (login, register, sessions)
   - Storing user settings and encrypted API keys
   
2. **User's Storage Project** - Each user's own Supabase project for:
   - File storage (buckets and files)
   - User configures this via Settings after login

This design allows multiple users to manage their own independent Supabase storage projects through a single application.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Two Supabase projects (one for auth, one for storage)

### 1. Installation

```bash
npm install
```

### 2. Set Up Auth Project

Create a Supabase project for authentication:

1. Go to [Supabase Dashboard](https://app.supabase.com) and create a new project
2. Go to **SQL Editor** and run the migration in `database/user_settings.sql`
3. Note your project URL and keys from **Settings** → **API**

### 3. Configure Environment

Copy `env.example` to `.env` and configure:

```env
# Auth Supabase (required)
NEXT_PUBLIC_AUTH_SUPABASE_URL=https://your-auth-project.supabase.co
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=your-anon-key
AUTH_SUPABASE_SERVICE_KEY=your-service-role-key

# Encryption key (required) - generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-character-hex-key
```

### 4. Run the Application

**Development:**
```bash
npm run dev
```

Visit `http://localhost:3000`

**Production:**
```bash
npm run build
npm start
```

### 5. First-Time Setup

1. Register an account at `/login`
2. Click the Settings icon (⚙️) in the header
3. Enter your storage Supabase project URL and service role key
4. Click "Test Connection" to verify
5. Save settings and start managing files!

## 🌐 Web Interface Guide

### Login / Register

- Create an account with email and password
- Sessions are managed automatically with secure cookies

### Settings Modal

- Configure your Supabase storage project
- Test connection before saving
- API keys are encrypted before storage

### Upload Tab

- **Drag & Drop** files onto the upload zone
- **Click to browse** and select files
- **Select bucket** from dropdown
- View upload progress with real-time progress bars
- Upload multiple files simultaneously

### Files Tab

- **Browse files** in your buckets with folder navigation
- **Search** files by name
- **Filter** by file type (images, videos, documents, etc.)
- **Sort** by date, size, or name
- **Preview** images, videos, PDFs, and audio files
- **Rename** files inline
- **Move** files between folders
- **Bulk select** for download or delete

### Logs Tab

- View application activity logs
- **Auto-refresh** option (every 5 seconds)
- Color-coded log levels (INFO, SUCCESS, ERROR)

## ⚙️ CLI Usage

The CLI tool (`uploadToSupabase.js`) uses environment variables for credentials:

```bash
# Interactive mode
npm run cli

# Upload a file
node uploadToSupabase.js ./file.pdf documents

# List files
node uploadToSupabase.js --list documents

# Download a file
node uploadToSupabase.js --download path/to/file.pdf documents

# Delete a file
node uploadToSupabase.js --delete path/to/file.pdf documents
```

For CLI usage, set `SUPABASE_URL` and `SUPABASE_KEY` in your `.env` file.

## 📦 Using as a Module

```javascript
const { 
  uploadFile, 
  downloadFile,
  listFiles,
  deleteFile
} = require('./uploadToSupabase');

await uploadFile('./document.pdf', 'documents', 'myfolder/document.pdf');
await listFiles('documents', 'myfolder');
```

## ⚙️ Configuration

See `env.example` for all configuration options:

```env
# Auth configuration (required)
NEXT_PUBLIC_AUTH_SUPABASE_URL=...
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=...
AUTH_SUPABASE_SERVICE_KEY=...
ENCRYPTION_KEY=...

# Legacy/CLI configuration (optional)
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_BUCKET=files
MAX_RETRIES=3
LOG_FILE=supabase-uploader.log
ENABLE_LOGGING=true

# Signed URL security defaults
SIGNED_URL_TTL_DEFAULT=60
SIGNED_URL_TTL_MIN=30
SIGNED_URL_TTL_MAX=300
SIGNED_URL_ALLOWED_PREFIXES=*

# Direct upload mode
DIRECT_UPLOAD_MAX_BYTES=104857600
DIRECT_UPLOAD_ALLOWED_MIME_REGEX=
```

## 🔌 API Notes (Signed URL Retrieval)

### `GET /api/files/signed-url`

Returns a short-lived signed URL for an object.

**Query params:**
- `path` (required)
- `bucket` (optional, defaults to user default bucket)
- `ttl` (optional, must be within `SIGNED_URL_TTL_MIN..SIGNED_URL_TTL_MAX`)
- `download` (optional: `true`/`1` to force attachment)

**Security checks:**
- Requires authentication
- Validates object key path and bucket
- Enforces server-side TTL bounds
- Enforces object key scope via `SIGNED_URL_ALLOWED_PREFIXES` (supports `{userId}` template, defaults to `*` for backward compatibility)

### `GET /api/download`

Now issues a short-lived signed URL and redirects to Supabase Storage (instead of proxy-streaming through the app server). The same TTL and scope policies are enforced.

<<<<<<< HEAD
## 🔁 Resumable Upload API (MVP)

This MVP exposes a server-managed resumable session API (sequential chunk upload).

### 1) Create session

`POST /api/upload-sessions/create`

Body:
```json
{
  "bucket": "files",
  "path": "videos/big.mp4",
  "fileName": "big.mp4",
  "totalSize": 15728640,
  "chunkSize": 6291456,
  "fileSha256": "optional-final-sha256",
  "expiresInSeconds": 3600
}
```

Response (`201`):
- `uploadId` / `session.id`
- `nextOffset` (starts at `0`)
- `expiresAt`

### 2) Append chunk

`PATCH /api/upload-sessions/:sessionId/append`

Headers:
- `Upload-Offset: <current_offset>` (required)
- `X-Chunk-Sha256: <sha256>` (optional integrity check)

Body:
- raw binary chunk bytes

Response (`200`):
- `uploadedBytes`
- `nextOffset`
- `completed` (boolean)

If interrupted, call `GET /api/upload-sessions/:sessionId/append` to read current `nextOffset` and continue from that offset.
If offset is wrong, API returns `409` with `expectedOffset`.

### 3) Complete upload

`POST /api/upload-sessions/:sessionId/complete`

Server validates completeness (`uploadedBytes === totalSize`), optionally validates final SHA-256 (if provided at creation), then uploads the assembled temp file to Supabase Storage.

### Expiration

- Sessions auto-expire (default 1 hour, max 24 hours).
- Expired sessions return `410 Gone` and temp files are cleaned up.

### Client flow summary

1. Create session once.
2. Upload chunks sequentially with `Upload-Offset`.
3. On network failure/timeouts, fetch session state (`GET append`) and resume from `nextOffset`.
4. Call complete when all bytes are uploaded.

## 🚀 Direct Upload API

### `POST /api/upload/intents`
Creates an upload intent and returns a pre-signed upload payload.

### `POST /api/upload/finalize`
Finalizes an uploaded object with ownership/scope checks and idempotency via `Idempotency-Key`.

## 🔧 Troubleshooting

**"Authentication required"**
- Log in at `/login` first
- Check that auth environment variables are configured

**"Supabase storage is not configured"**
- Open Settings and configure your Supabase project credentials

**"Connection failed"**
- Verify Supabase URL format: `https://your-project.supabase.co`
- Use `service_role` key (not `anon` key) for storage operations

**"Bucket not found"**
- Create the bucket in your storage Supabase project first

**Port already in use**
- Change port: `PORT=3001 npm run dev`

## 🔒 Security

- ✅ **Encrypted API Keys** - User credentials encrypted with AES-256-GCM
- ✅ **JWT Authentication** - Secure session tokens with auto-refresh
- ✅ **Row Level Security** - Users can only access their own settings
- ✅ **Rate Limiting** - API abuse prevention with configurable limits
- ✅ **Path Traversal Protection** - Blocks malicious file paths
- ✅ **File Type Validation** - Magic byte verification, blocked executables
- ✅ **Security Headers** - CSP, X-Frame-Options, and more

See `SECURITY.md` for detailed security documentation.

### Baseline controls (Issue #22)

- **RBAC:** `admin` / `operator` / `read-only`
- **Quotas:** request, bandwidth, and storage baseline enforcement hooks
- **Audit trail:** append-only hash-chained event log + `GET /api/audit` query endpoint

Configure via `env.example`:
`RBAC_ADMIN_EMAILS`, `RBAC_OPERATOR_EMAILS`, `QUOTA_REQUEST_WINDOW_MS`,
`QUOTA_MAX_REQUESTS_PER_WINDOW`, `QUOTA_MAX_BANDWIDTH_BYTES_PER_WINDOW`,
`QUOTA_MAX_STORAGE_BYTES`, `AUDIT_LOG_FILE`.

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Next.js API Routes
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (user-configured)
- **Encryption:** Node.js crypto (AES-256-GCM)
- **CLI:** Node.js with inquirer

## 📄 License

MIT
