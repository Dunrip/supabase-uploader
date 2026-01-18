# Supabase File Manager

A multi-user file management platform for Supabase Storage built with Next.js 14, React 18, and Tailwind CSS. The application provides a dark-themed web interface for uploading, browsing, previewing, and managing files stored in Supabase Storage buckets. It uses a two-project architecture: one Supabase project for authentication and user settings, and each user connects their own Supabase project for file storage.

## File Structure

- **`/components/`** - React UI components (FilePreview, FilesTab, LoginForm, SettingsModal, Toast, UploadTab, etc.)
- **`/contexts/`** - React contexts (AuthContext for authentication state)
- **`/pages/`** - Next.js pages and API routes
  - `/pages/api/` - Backend API endpoints for auth, files, buckets, settings, uploads, downloads
- **`/utils/`** - Utility modules (encryption, auth middleware, storage operations, Supabase clients)
- **`/database/`** - SQL migrations for the auth project (user_settings.sql)
- **`/config/`** - Configuration examples
- **`/styles/`** - Global CSS with Tailwind
- **`uploadToSupabase.js`** - CLI tool for command-line file operations

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run cli          # Run CLI tool interactively
```

## Getting Started

1. Copy `env.example` to `.env` and configure your auth Supabase project credentials and encryption key
2. Run the SQL migration in `database/user_settings.sql` on your auth Supabase project
3. Run `npm install` then `npm run dev`
4. Register an account, then configure your storage Supabase project in Settings

See `README.md` for detailed setup instructions and `SECURITY.md` for security documentation.
