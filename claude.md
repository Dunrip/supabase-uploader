# Supabase File Manager

A multi-user file management application built with Next.js and Supabase Storage. Each user authenticates and configures their own Supabase storage project.

## Project Overview

This is a web-based file manager that allows uploading, downloading, previewing, and managing files stored in Supabase Storage buckets. It features user authentication, encrypted credential storage, and per-user Supabase project configuration.

## Architecture

**Two-Project Design:**
1. **Auth Project** - Central Supabase project for authentication and storing user settings
2. **User's Storage Project** - Each user connects their own Supabase project for file storage

**Key Concepts:**
- Users register/login with email and password
- After login, users configure their Supabase storage credentials in Settings
- API keys are encrypted with AES-256-GCM before storing in database
- Each API request uses the authenticated user's decrypted credentials

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, JWT authentication
- **Auth**: Supabase Auth (central project)
- **Storage**: Supabase Storage (user-configured)
- **Encryption**: Node.js crypto (AES-256-GCM)
- **File Parsing**: Formidable (multipart form data)
- **CLI**: Node.js with inquirer, cli-progress

## Project Structure

```
SUPABASE-UPLOADER/
├── pages/
│   ├── api/
│   │   ├── auth/               # Auth endpoints (login, register, logout)
│   │   ├── settings.js         # User settings CRUD
│   │   ├── settings/test.js    # Test Supabase connection
│   │   ├── buckets.js          # List buckets (auth required)
│   │   ├── upload.js           # Upload files
│   │   ├── files.js            # List/delete files
│   │   ├── download.js         # Download files
│   │   ├── preview.js          # Preview files
│   │   ├── rename.js           # Rename files
│   │   ├── move.js             # Move files
│   │   ├── folders.js          # Create/delete folders
│   │   ├── bulk-download.js    # Bulk download as ZIP
│   │   ├── files/url.js        # Get file URLs
│   │   ├── logs.js             # Activity logs
│   │   └── health.js           # Health check
│   ├── login.js                # Login/register page
│   ├── index.js                # Main UI (auth required)
│   └── _app.js                 # AuthProvider wrapper
├── components/
│   ├── LoginForm.js            # Auth form component
│   ├── SettingsModal.js        # Supabase config modal
│   ├── UploadTab.js            # Upload interface
│   ├── FilesTab.js             # File management
│   ├── LogsTab.js              # Log viewer
│   ├── FilePreview.js          # Preview modal
│   ├── ConfirmModal.js         # Confirmation dialogs
│   └── Toast.js                # Notifications
├── contexts/
│   └── AuthContext.js          # Auth state and methods
├── utils/
│   ├── authMiddleware.js       # JWT verification middleware
│   ├── authSupabaseClient.js   # Auth Supabase client
│   ├── storageClientFactory.js # Creates user's storage client
│   ├── userSettings.js         # Settings CRUD operations
│   ├── encryption.js           # AES-256-GCM encryption
│   ├── security.js             # Path/file validation
│   ├── apiHelpers.js           # Response helpers
│   ├── serverHelpers.js        # Server utilities
│   ├── clientHelpers.js        # Client utilities
│   ├── uploadHelpers.js        # Upload utilities
│   └── bucketHelpers.js        # Bucket utilities
├── database/
│   └── user_settings.sql       # Auth project migration
├── uploadToSupabase.js         # CLI tool
└── middleware.js               # Rate limiting
```

## Key Files

- `contexts/AuthContext.js` - Auth state, signIn/signUp/signOut, settings management
- `utils/authMiddleware.js` - `withAuth()` HOC for protected API routes
- `utils/storageClientFactory.js` - Creates Supabase clients with user's credentials
- `utils/encryption.js` - AES-256-GCM encrypt/decrypt for API keys
- `utils/userSettings.js` - CRUD for user settings in auth database
- `pages/api/settings.js` - GET/POST user Supabase credentials
- `components/SettingsModal.js` - UI for configuring Supabase connection

## Environment Variables

Required in `.env`:
```env
# Auth Supabase (central project)
NEXT_PUBLIC_AUTH_SUPABASE_URL=https://your-auth-project.supabase.co
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=your-anon-key
AUTH_SUPABASE_SERVICE_KEY=your-service-role-key

# Encryption key (32 bytes as 64 hex chars)
ENCRYPTION_KEY=your-64-char-hex-key
```

Optional (for CLI backward compatibility):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
SUPABASE_BUCKET=files
MAX_RETRIES=3
LOG_FILE=supabase-uploader.log
ENABLE_LOGGING=true
```

## Commands

```bash
npm run dev      # Development server on :3000
npm run build    # Production build
npm start        # Start production server
npm run cli      # Run CLI tool
npm run lint     # ESLint check
```

## API Endpoints

All storage endpoints require authentication (except `/api/health`).

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET/POST | User Supabase credentials |
| `/api/settings/test` | POST | Test Supabase connection |
| `/api/upload` | POST | Upload file (multipart form) |
| `/api/files` | GET | List files in bucket |
| `/api/files` | DELETE | Delete file |
| `/api/download` | GET | Download file |
| `/api/preview` | GET | Preview file content |
| `/api/buckets` | GET | List all buckets |
| `/api/files/url` | GET | Get file URL |
| `/api/rename` | POST | Rename file |
| `/api/move` | POST | Move file to folder |
| `/api/folders` | POST/DELETE | Create/delete folders |
| `/api/bulk-download` | POST | Download multiple files as ZIP |
| `/api/logs` | GET | Get log entries |
| `/api/health` | GET | Health check |

## Security Features

- **User Authentication** - Email/password with Supabase Auth
- **Encrypted Credentials** - API keys encrypted with AES-256-GCM
- **JWT Verification** - All protected routes verify access tokens
- **Rate Limiting** - Configurable per-endpoint limits
- **Path Traversal Protection** - Blocks `../` and malicious paths
- **File Type Validation** - Magic byte checking, blocks executables
- **Security Headers** - CSP, X-Frame-Options, nosniff, etc.
- **Row Level Security** - Users access only their own settings

## Limitations

- Max 100MB file size
- 5-minute upload timeout
- In-memory rate limiter (not suitable for multi-instance)

## Database Schema

Run `database/user_settings.sql` in your auth Supabase project:

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  supabase_url TEXT,
  supabase_key_encrypted TEXT,  -- AES-256-GCM encrypted
  default_bucket TEXT DEFAULT 'files',
  max_retries INTEGER DEFAULT 3,
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## See Also

- `README.md` - User-facing documentation
- `TODO.md` - Feature roadmap
- `SECURITY.md` - Detailed security documentation
- `CHANGELOG.md` - Version history
