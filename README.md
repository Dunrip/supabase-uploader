<div align="center">

# 📦 Supabase File Manager

**The complete platform for managing files in Supabase Storage**

Build, manage, and organize your files with a beautiful dark-themed web interface. Upload, preview, download, and delete files effortlessly across multiple buckets.

---

</div>

## 📑 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
  - [Installation](#1-installation)
  - [Configure Environment](#2-configure-environment)
  - [Create Storage Bucket](#3-create-storage-bucket)
  - [Run the Application](#4-run-the-application)
- [Web Interface Guide](#-web-interface-guide)
  - [Upload Tab](#upload-tab)
  - [Files Tab](#files-tab)
  - [Logs Tab](#logs-tab)
- [CLI Usage](#-cli-usage)
- [Using as a Module](#-using-as-a-module)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## ✨ Features

- 🌐 **Web Interface** - Beautiful, responsive dark-themed UI
- 📤 **Upload Files** - Drag & drop or browse, with progress tracking
- 📋 **File Management** - List, preview, download, and delete files
- 🔍 **Search** - Quickly find files by name
- 📦 **Multi-Bucket Support** - Switch between buckets easily
- 📄 **File Preview** - Preview images, videos, PDFs, and audio files
- 📊 **Activity Logs** - View application logs in real-time
- ⚙️ **CLI Tool** - Command-line interface for automation

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_BUCKET=files
```

**Getting Your Credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project → **Settings** → **API**
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **service_role** key → `SUPABASE_KEY`

⚠️ **Important:** Use the `service_role` key (not `anon` key) for server-side operations.

### 3. Create Storage Bucket

1. In Supabase Dashboard → **Storage**
2. Click **New bucket**
3. Enter bucket name and choose visibility (Public/Private)

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

## 🌐 Web Interface Guide

### Upload Tab

- **Drag & Drop** files onto the upload zone
- **Click to browse** and select files
- **Select bucket** from dropdown
- View upload progress with real-time progress bars
- Upload multiple files simultaneously

### Files Tab

- **Browse files** in your buckets
- **Search** files by name
- **Preview** images, videos, PDFs, and audio files
- **Download** files directly
- **Delete** files with confirmation
- **Upload** files directly from this tab

### Logs Tab

- View application activity logs
- **Auto-refresh** option (every 5 seconds)
- Color-coded log levels (INFO, SUCCESS, ERROR)
- View last 50 log entries

## ⚙️ CLI Usage

The CLI tool (`uploadToSupabase.js`) is available for automation:

```bash
# Interactive mode
npm run cli
# or
node uploadToSupabase.js

# Upload a file
node uploadToSupabase.js ./file.pdf documents

# List files
node uploadToSupabase.js --list documents

# Download a file
node uploadToSupabase.js --download path/to/file.pdf documents

# Delete a file
node uploadToSupabase.js --delete path/to/file.pdf documents
```

For more CLI options, run `node uploadToSupabase.js --help`

## 📦 Using as a Module

Import functions in your own scripts:

```javascript
const { 
  uploadFile, 
  downloadFile,
  listFiles,
  deleteFile
} = require('./uploadToSupabase');

// Upload a file
await uploadFile('./document.pdf', 'documents', 'myfolder/document.pdf');

// List files
await listFiles('documents', 'myfolder');
```

## ⚙️ Configuration

Optional environment variables in `.env`:

```env
# Default bucket name (optional, defaults to 'files')
SUPABASE_BUCKET=files

# Maximum retry attempts (optional, defaults to 3)
MAX_RETRIES=3

# Log file path (optional, defaults to 'supabase-uploader.log')
LOG_FILE=supabase-uploader.log

# Enable file logging (optional, defaults to 'true')
ENABLE_LOGGING=true
```

## 🔧 Troubleshooting

**"Missing required environment variables"**
- Ensure `.env` exists with `SUPABASE_URL` and `SUPABASE_KEY`

**"Bucket not found"**
- Create the bucket in Supabase Dashboard first
- Verify bucket name matches exactly

**"Permission denied"**
- Use `service_role` key (not `anon` key)
- Check bucket policies in Supabase Dashboard

**Port already in use**
- Change port: `PORT=3001 npm run dev`

## 🔒 Security

- ✅ `.env` file is in `.gitignore` (never commit it)
- ✅ Use `service_role` key only on server-side
- ✅ Set appropriate bucket policies for sensitive files
- ✅ Rotate keys regularly

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Next.js API Routes
- **Storage:** Supabase Storage
- **CLI:** Node.js with inquirer

## 📄 License

MIT
