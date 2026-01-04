# Changelog

## Unreleased (authentication)

### Added
- **User Authentication System**
  - Email/password authentication using Supabase Auth
  - Login and register pages with form validation
  - JWT session management with auto-refresh
  - Auth context provider with signIn/signUp/signOut methods
  - Auth middleware for protecting API routes

- **Multi-User Supabase Configuration**
  - Each user can connect their own Supabase storage project
  - Settings modal for configuring Supabase URL and API key
  - Test connection functionality before saving
  - Database migration for user_settings table (with RLS)

- **Encrypted Credential Storage**
  - AES-256-GCM encryption for user API keys at rest
  - Secure encryption key from environment variable
  - Key masking for display in settings UI

- **Storage Client Factory**
  - Dynamic Supabase client creation per user
  - Decrypts user credentials on each request
  - Proper error handling for unconfigured users

### Changed
- All storage API endpoints now require authentication
- Environment variables updated for auth configuration
- Updated documentation (README, claude.md, SECURITY.md)

### Security
- Added `withAuth` middleware for protected routes
- JWT verification on all storage operations
- Row Level Security on user_settings table
- Encrypted storage of sensitive API keys

## Previous (dev branch)
- Add API endpoints for bulk downloads, folder create/delete, move, rename, and health checks
- Add API rate limiting middleware and stricter security headers
- Add env validation, API response helpers, and storage path/bucket/filename security validation
- Refresh web UI components (files, uploads, logs) and add a confirm modal
- Add `ENABLE_EMOJI` flag to disable emoji in CLI output

## v1.1.0
- Differentiate batch files for interactive vs CLI use
- Auto-create .env and simplify setup in batch files

## v1.0.0
- Add Windows batch files for CLI usage
- Add Next.js web UI with dark theme

## Initial
- Initial Supabase uploader CLI
