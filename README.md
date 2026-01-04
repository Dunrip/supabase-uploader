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
```

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

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Next.js API Routes
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (user-configured)
- **Encryption:** Node.js crypto (AES-256-GCM)
- **CLI:** Node.js with inquirer

## 📄 License

MIT
