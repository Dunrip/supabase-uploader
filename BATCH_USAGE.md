# Windows Batch File Usage Guide

## Quick Start

1. **First Time Setup:**
   - Double-click `setup.bat` to install dependencies and configure

2. **Interactive Mode (Recommended for beginners):**
   - Double-click `supabase-uploader-interactive.bat`
   - Follow the on-screen prompts

3. **Command Line Mode:**
   - Use `supabase-uploader.bat` with arguments
   - Examples:
     ```
     supabase-uploader.bat file.pdf
     supabase-uploader.bat --list
     supabase-uploader.bat --download path/to/file.pdf documents
     ```

## Requirements

- Windows OS
- Node.js 14+ installed (download from https://nodejs.org/)
- `.env` file with Supabase credentials

## File Descriptions

- `setup.bat` - Initial setup (installs dependencies, creates .env)
- `supabase-uploader.bat` - Main CLI tool
- `supabase-uploader-interactive.bat` - Interactive mode launcher

## Troubleshooting

**"Node.js is not installed"**
- Install Node.js from https://nodejs.org/
- Make sure it's added to your system PATH

**"Failed to install dependencies"**
- Check your internet connection
- Try running `npm install` manually in the folder

**".env file not found"**
- Copy `env.example` to `.env`
- Add your Supabase credentials

## Command Examples

### Upload a file
```cmd
supabase-uploader.bat file.pdf
supabase-uploader.bat file.pdf documents
supabase-uploader.bat file.pdf documents myfolder/file.pdf
```

### Upload multiple files
```cmd
supabase-uploader.bat --batch file1.jpg file2.jpg file3.jpg images
```

### List files
```cmd
supabase-uploader.bat --list
supabase-uploader.bat --list documents
supabase-uploader.bat --list documents myfolder
```

### Download a file
```cmd
supabase-uploader.bat --download path/to/file.pdf
supabase-uploader.bat --download path/to/file.pdf documents
supabase-uploader.bat --download path/to/file.pdf documents ./downloads/
```

### Delete a file
```cmd
supabase-uploader.bat --delete path/to/file.pdf
supabase-uploader.bat --delete path/to/file.pdf documents
```

## Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project → **Settings** → **API**
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **service_role** key → `SUPABASE_KEY`

⚠️ **Important:** Use the `service_role` key (not `anon` key) for server-side operations.
