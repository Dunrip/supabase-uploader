# Supabase File Manager - TODO

## Security Improvements (Critical)

### High Priority
- [x] **Rate Limiting** - Add rate limiting middleware to prevent API abuse
  - ✅ Implemented in `middleware.js` with in-memory rate limiter
  - ✅ Configurable limits per endpoint (uploads: 20/min, downloads: 100/min)
  - ✅ Returns 429 with Retry-After header when exceeded

- [x] **Path Traversal Protection** - Validate storage paths
  - ✅ Implemented in `utils/security.js`
  - ✅ Rejects `../`, absolute paths, URL-encoded attacks, null bytes
  - ✅ Integrated into all API routes (upload, download, files, preview)

- [x] **File Type Validation** - Server-side MIME verification
  - ✅ Implemented in `utils/security.js` with magic byte checking
  - ✅ Validates images, documents, archives, audio, video
  - ✅ Blocks executables (.exe, .sh, .bat, .cmd, .ps1, .php, etc.)

- [x] **Security Headers** - Add CSP headers in `next.config.js`
  - ✅ X-Content-Type-Options: nosniff
  - ✅ X-Frame-Options: DENY
  - ✅ X-XSS-Protection: 1; mode=block
  - ✅ Content-Security-Policy (restrictive)
  - ✅ Referrer-Policy, Permissions-Policy

- [x] **Environment Validation** - Startup checks for required env vars
  - ✅ Implemented in `utils/envValidation.js`
  - ✅ Validates SUPABASE_URL format (must be valid URL)
  - ✅ Validates SUPABASE_KEY format (JWT structure)
  - ✅ Fails fast on first Supabase client usage

### Medium Priority
- [ ] **Authentication** - Add user authentication
  - Option A: Supabase Auth (recommended - native integration)
  - Option B: NextAuth.js
  - Option C: Simple API key for single-user deployment

- [x] **Input Sanitization** - Stricter validation
  - ✅ Bucket name regex validation (alphanumeric, hyphens, underscores)
  - ✅ File path character restrictions (no traversal, null bytes)
  - ✅ Maximum filename length enforcement (255 chars)

- [ ] **CORS Configuration** - Proper cross-origin settings
  - Configure allowed origins for production
  - Restrict to specific domains

---

## Bug Fixes

- [x] **Enable TypeScript Strict Mode** - `tsconfig.json` has `strict: false`
  - ✅ Already enabled in `tsconfig.json` (`strict: true`)

- [x] **Improve Rename Button**
  - ✅ Removed yellow rename button
  - ✅ Added pencil icon next to filename (Apple style, appears on hover)
  - ✅ Fixed input box sizing - scales with filename length (min 100px, max 400px)
  - ✅ Compact save/cancel buttons with icons

- [x] **Fix in directory upload path**
  - ✅ Added `folderPath` parameter to `uploadFileWithProgress()` in `uploadHelpers.js`
  - ✅ Files now upload to current folder when inside a subdirectory
  - ✅ Changing bucket resets path to root via `handleBucketChange()`

- [x] **Loading States** - Missing UI feedback
  - ✅ Skeleton loaders during file list fetch
  - ✅ Loading indicator on bucket switch

- [x] **Standardize Error Responses** - Inconsistent formats
  - ✅ Created unified error response helper in `utils/apiHelpers.js`
  - ✅ All API routes now use `sendSuccess()` and `sendError()` functions
  - ✅ Consistent `{ success: true/false, error?: string }` format

- [x] **Temp File Cleanup** - Race condition in async cleanup
  - ✅ Added retry logic with configurable attempts (default: 3)
  - ✅ Cleanup failures are logged for debugging
  - ✅ Both sync and async versions available in `serverHelpers.js`

- [x] **Large File Streaming** - Memory issues
  - ✅ Downloads use streaming for files > 50MB threshold
  - ✅ Implemented in `pages/api/download.js` with Readable stream

- [x] **Content-Disposition Header Escaping** - Security fix
  - ✅ Both download.js and preview.js now properly escape filenames
  - ✅ RFC 5987 compliant with `filename` and `filename*` parameters
  - ✅ Handles quotes, newlines, and special characters

---

## Features - High Priority (Deployment Ready)

- [x] **Health Check Endpoint** - `/api/health`
  - ✅ Returns server status, Supabase connection status
  - ✅ Includes response time, uptime, bucket count

- [x] **Folder Management**
  - ✅ Create empty folders (with .folder placeholder)
  - ✅ Move files between folders
  - ✅ Delete folders recursively
  - ✅ Breadcrumb navigation with up button
  - ✅ Folders shown separately from files
  - ✅ Click folder to navigate into it

- [x] **Bulk Operations**
  - ✅ Select multiple files with checkboxes
  - ✅ Select all / deselect all
  - ✅ Bulk delete selected files with confirmation
  - ✅ Bulk download as zip (using archiver)
  - ✅ Selection indicator bar with count and actions
  - ✅ Max 100 files, 500MB total size limit for bulk download

- [x] **Search & Filter**
  - ✅ Search files by name with clear button
  - ✅ Filter by file type categories (Image, Video, Audio, Document, Spreadsheet, Archive, Code)
  - ✅ Sort by date (newest/oldest), size (largest/smallest), name (A-Z/Z-A)
  - ✅ Category counts shown as badges
  - ✅ Clear filters buttons when no results

- [x] **Rename Files**
  - ✅ Inline rename with input field
  - ✅ Enter to save, Escape to cancel
  - ✅ Conflict detection (409 error if name exists)
  - ✅ Validation for filename characters
  - ✅ API endpoint with copy-delete pattern (Supabase limitation)

---

## Features - Medium Priority

- [ ] **File Sharing**
  - Generate temporary public/signed URLs
  - Set expiration time
  - Copy link to clipboard

- [ ] **Image Thumbnails**
  - Generate previews for image files
  - Lazy load thumbnails in file list
  - Cache generated thumbnails

- [ ] **Upload Improvements**
  - Resume failed uploads
  - Chunk large files
  - Pause/resume capability

- [ ] **Keyboard Shortcuts**
  - `Del` - Delete selected
  - `Enter` - Preview/open
  - `Ctrl+A` - Select all
  - Arrow keys - Navigate list

- [ ] **Drag-and-Drop Organization**
  - Reorder files
  - Move to folders via drag

---

## Features - Nice to Have

- [ ] **File Versioning** - Keep upload history
- [ ] **Storage Quota Display** - Show bucket usage stats
- [ ] **Compression** - Zip multiple files for download
- [ ] **Mobile Polish** - Improve touch interactions
- [ ] **Dark/Light Theme Toggle** - Currently dark only
- [ ] **Breadcrumb Navigation** - For folder paths
- [ ] **Recent Files** - Quick access to recently uploaded
- [ ] **Favorites** - Star important files

---

## Testing

- [ ] **Unit Tests** - Utility functions
  - Test escaping functions
  - Test file size formatting
  - Test date formatting

- [ ] **API Route Tests**
  - Test upload endpoint
  - Test download endpoint
  - Test file listing
  - Test deletion
  - Test error cases

- [ ] **Component Tests**
  - Test UploadTab interactions
  - Test FilesTab file list
  - Test FilePreview modal

- [ ] **E2E Tests**
  - Full upload flow
  - Download flow
  - Delete flow

---

## Deployment Checklist

```
Pre-Deployment:
[x] Rate limiting implemented
[x] Security headers configured
[x] Path traversal protection added
[x] Environment validation on startup
[x] Health check endpoint working
[x] Error responses standardized (apiHelpers.js)
[x] Content-Disposition header escaping (RFC 5987)
[x] File type validation with magic bytes
[x] Temp file cleanup with retry logic
[x] TypeScript strict mode enabled
[ ] Basic tests passing

Deployment:
[ ] NODE_ENV=production
[ ] Supabase bucket created and configured
[ ] Environment variables set in hosting platform
[ ] CORS configured for production domain
[ ] SSL/HTTPS enabled
[ ] Monitoring/logging configured

Post-Deployment:
[ ] Test all endpoints in production
[ ] Verify file upload/download works
[ ] Check error handling
[ ] Monitor for issues
```

---

## Notes

- Max file size: 100MB (configurable in upload.js)
- Upload timeout: 5 minutes
- Log file: supabase-uploader.log (last 50 entries shown in UI)
- CLI tool: `npm run cli` or `node uploadToSupabase.js`
