# Supabase File Manager

A full-stack file management application built with Next.js and Supabase Storage.

## Project Overview

This is a web-based file manager that allows uploading, downloading, previewing, and managing files stored in Supabase Storage buckets. It includes both a web UI and a CLI tool.

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Storage**: Supabase Storage (@supabase/supabase-js)
- **File Parsing**: Formidable (multipart form data)
- **CLI**: Node.js with inquirer, cli-progress

## Project Structure

```
SUPABASE-UPLOADER/
├── pages/
│   ├── api/                    # API endpoints
│   │   ├── buckets.js          # GET - List buckets
│   │   ├── download.js         # GET - Download files
│   │   ├── files.js            # GET/DELETE - List/delete files
│   │   ├── logs.js             # GET - Read logs
│   │   ├── preview.js          # GET - Preview files
│   │   ├── upload.js           # POST - Upload files
│   │   └── files/url.js        # GET - Get file URLs
│   ├── _app.js
│   └── index.js                # Main UI
├── components/
│   ├── UploadTab.js            # Upload interface
│   ├── FilesTab.js             # File management
│   ├── LogsTab.js              # Log viewer
│   ├── FilePreview.js          # Preview modal
│   └── Toast.js                # Notifications
├── utils/
│   ├── supabaseClient.js       # Supabase client
│   ├── serverHelpers.js        # Server utilities
│   ├── clientHelpers.js        # Client utilities
│   ├── api.js                  # API helpers
│   ├── uploadHelpers.js        # Upload utilities
│   └── bucketHelpers.js        # Bucket utilities
├── uploadToSupabase.js         # CLI tool
└── styles/globals.css          # Tailwind styles
```

## Key Files

- `pages/api/upload.js` - Handles file uploads with Formidable, 100MB max, 5min timeout
- `pages/api/files.js` - List and delete files from buckets
- `pages/api/download.js` - Stream files to client with proper headers
- `uploadToSupabase.js` - Standalone CLI for batch uploads, exports reusable functions
- `utils/serverHelpers.js` - Security functions (escapeHtml, cleanupTempFile, withTimeout)
- `utils/clientHelpers.js` - Formatting (formatFileSize, formatDate, getFileIcon)

## Environment Variables

Required in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
```

Optional:
```
SUPABASE_BUCKET=files          # Default bucket name
MAX_RETRIES=3                  # Upload retry attempts
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

## CLI Usage

```bash
# Single file
node uploadToSupabase.js <file> [bucket] [path]

# Batch upload
node uploadToSupabase.js --batch file1 file2 ... [bucket]

# Directory upload
node uploadToSupabase.js --dir ./folder [bucket] [--recursive]
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload file (multipart form) |
| `/api/files` | GET | List files in bucket |
| `/api/files` | DELETE | Delete file |
| `/api/download` | GET | Download file |
| `/api/preview` | GET | Preview file content |
| `/api/buckets` | GET | List all buckets |
| `/api/files/url` | GET | Get file URL |
| `/api/logs` | GET | Get log entries |

## Security Considerations

- Uses service_role key (server-side only, never expose to client)
- XSS protection via escape functions in serverHelpers.js
- Temp files cleaned up after upload processing
- All file operations go through API routes (no direct bucket access)

## Limitations

- No user authentication (shared bucket access)
- No rate limiting (implement before production)
- Max 100MB file size
- 5-minute upload timeout
- Files loaded into memory (streaming needed for large files)

## Preview Support

- **Images**: jpg, jpeg, png, gif, webp, svg, bmp
- **Video**: mp4, avi, mov, webm, mkv
- **Audio**: mp3, wav, ogg
- **Documents**: pdf

## Theme

Dark theme with custom Tailwind colors defined in `tailwind.config.js`. Primary accent: indigo (#6366f1).

## Logging

Logs written to `supabase-uploader.log` with format:
```
[ISO_TIMESTAMP] [LEVEL] message {JSON_DATA}
```

View in UI via Logs tab (last 50 entries) or read file directly.

## See Also

- `TODO.md` - Feature roadmap and security improvements
- `SECURITY.md` - Security documentation
- `README.md` - User-facing documentation
