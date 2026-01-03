# Supabase File Manager - TODO

## Security Improvements (Critical)

### High Priority
- [ ] **Rate Limiting** - Add rate limiting middleware to prevent API abuse
  - Consider using `next-rate-limit` or Vercel Edge middleware
  - Limit: ~100 requests/minute per IP for uploads

- [ ] **Path Traversal Protection** - Validate storage paths
  - Reject paths containing `../` or absolute paths
  - Sanitize all user-provided path inputs

- [ ] **File Type Validation** - Server-side MIME verification
  - Verify magic bytes, not just file extension
  - Create allowlist of permitted file types
  - Block executable files (.exe, .sh, .bat, .cmd, .ps1)

- [ ] **Security Headers** - Add CSP headers in `next.config.js`
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Content-Security-Policy

- [ ] **Environment Validation** - Startup checks for required env vars
  - Fail fast if SUPABASE_URL or SUPABASE_KEY missing
  - Validate URL format

### Medium Priority
- [ ] **Authentication** - Add user authentication
  - Option A: Supabase Auth (recommended - native integration)
  - Option B: NextAuth.js
  - Option C: Simple API key for single-user deployment

- [ ] **Input Sanitization** - Stricter validation
  - Bucket name regex validation
  - File path character restrictions
  - Maximum filename length enforcement

- [ ] **CORS Configuration** - Proper cross-origin settings
  - Configure allowed origins for production
  - Restrict to specific domains

---

## Bug Fixes

- [ ] **Enable TypeScript Strict Mode** - `tsconfig.json` has `strict: false`
  - Enable strict mode for better type safety
  - Fix any resulting type errors

- [ ] **Standardize Error Responses** - Inconsistent formats
  - Some return `{ error }`, others `{ success: false, error }`
  - Create unified error response helper

- [ ] **Temp File Cleanup** - Race condition in async cleanup
  - Add retry logic for failed deletions
  - Log cleanup failures for debugging

- [ ] **Large File Streaming** - Memory issues
  - Downloads currently load entire file into memory
  - Implement proper streaming for files > 50MB

- [ ] **Loading States** - Missing UI feedback
  - Add skeleton loaders during file list fetch
  - Show loading indicator on bucket switch

---

## Features - High Priority (Deployment Ready)

- [ ] **Health Check Endpoint** - `/api/health`
  - Return server status, Supabase connection status
  - Useful for monitoring and load balancers

- [ ] **Folder Management**
  - Create empty folders
  - Move files between folders
  - Delete folders recursively

- [ ] **Bulk Operations**
  - Select multiple files with checkboxes
  - Bulk delete selected files
  - Bulk download as zip

- [ ] **Search & Filter**
  - Search files by name
  - Filter by file type
  - Sort by date, size, name

- [ ] **Rename Files** - Currently not possible
  - Rename in place
  - Handle name conflicts

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
[ ] Rate limiting implemented
[ ] Security headers configured
[ ] Path traversal protection added
[ ] Environment validation on startup
[ ] Health check endpoint working
[ ] TypeScript strict mode enabled
[ ] Error responses standardized
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
