# Supabase File Uploader

A Node.js script for pushing files to Supabase Storage buckets. Perfect for automation on Hostinger VPS or any Node.js environment.

## Features

- ✅ Upload single files to Supabase Storage
- ✅ **Batch upload** - Upload multiple files at once with progress tracking
- ✅ Upload entire directories (with recursive option)
- ✅ **Download files** from Supabase Storage
- ✅ **Progress bars** for uploads and downloads
- ✅ **Retry logic** with exponential backoff for failed operations
- ✅ **Interactive CLI mode** - Menu-driven interface for easy operation
- ✅ **File logging** - Automatic logging of all operations to file
- ✅ List files in buckets
- ✅ Delete files from buckets
- ✅ Automatic content-type detection
- ✅ Public URL generation
- ✅ Error handling and logging

## Installation

1. **Clone or navigate to this directory:**
   ```bash
   cd OTHER-CODING/SUPABASE-UPLOADER
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-service-role-key
   SUPABASE_BUCKET=files
   MAX_RETRIES=3
   LOG_FILE=supabase-uploader.log
   ENABLE_LOGGING=true
   ```
   
   **Optional:**
   - `MAX_RETRIES` - Controls how many times to retry failed operations (default: 3)
   - `LOG_FILE` - Path to log file (default: `supabase-uploader.log`)
   - `ENABLE_LOGGING` - Enable/disable file logging (default: `true`)

## Getting Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** > **API**
4. Copy your **Project URL** → `SUPABASE_URL`
5. Copy your **service_role** key (not the anon key) → `SUPABASE_KEY`

⚠️ **Important:** Use the `service_role` key (not `anon` key) for server-side operations. This key has admin privileges, so keep it secret!

## Creating a Storage Bucket

1. In Supabase Dashboard, go to **Storage**
2. Click **New bucket**
3. Enter a bucket name (e.g., `files`)
4. Choose visibility (Public or Private)
5. Click **Create bucket**

## Usage

### Interactive CLI Mode

Launch an interactive menu-driven interface:

```bash
# Start interactive mode
node uploadToSupabase.js --interactive
# or
node uploadToSupabase.js -i

# Or just run without arguments (defaults to interactive mode)
node uploadToSupabase.js
```

The interactive mode provides:
- 📤 Upload files/directories
- 📥 Download files
- 📋 List files in buckets
- 🗑️ Delete files
- 📄 View log file
- Easy-to-use menu interface

### Upload a Single File

```bash
# Basic upload (uses default bucket from .env)
# Progress bar will show for files > 1KB
node uploadToSupabase.js ./myfile.pdf

# Specify bucket
node uploadToSupabase.js ./myfile.pdf documents

# Specify bucket and storage path
node uploadToSupabase.js ./myfile.pdf documents myfolder/myfile.pdf
```

### Batch Upload Multiple Files

```bash
# Upload multiple files at once with batch progress bar
node uploadToSupabase.js --batch file1.jpg file2.jpg file3.jpg images

# With base storage path
node uploadToSupabase.js --batch file1.jpg file2.jpg images photos/

# With bucket and base path
node uploadToSupabase.js --batch file1.jpg file2.jpg images photos/2024
```

### Upload a Directory

```bash
# Upload entire directory (recursive)
# Uses batch upload with progress tracking
node uploadToSupabase.js ./myfolder documents
```

### Download Files

```bash
# Download a single file
node uploadToSupabase.js --download images/photo.jpg images

# Download to specific location
node uploadToSupabase.js --download images/photo.jpg images ./downloads/photo.jpg

# Batch download multiple files
node uploadToSupabase.js --download-batch images/photo1.jpg images/photo2.jpg images ./downloads/
```

### List Files in Bucket

```bash
# List all files in default bucket
node uploadToSupabase.js --list

# List files in specific bucket
node uploadToSupabase.js --list documents

# List files in specific folder
node uploadToSupabase.js --list documents myfolder
```

### Delete a File

```bash
# Delete from default bucket
node uploadToSupabase.js --delete myfolder/file.pdf

# Delete from specific bucket
node uploadToSupabase.js --delete myfolder/file.pdf documents
```

## Advanced Features

### Progress Bars

Progress bars automatically appear for:
- Single file uploads (files > 1KB)
- Batch uploads (shows file count progress)
- Downloads (shows download progress)

### Retry Logic

All operations automatically retry on failure with exponential backoff:
- Default: 3 retries
- Delay increases: 1s, 2s, 4s between attempts
- Configure with `MAX_RETRIES` in `.env`

### Batch Operations

Batch uploads and downloads show:
- Overall progress bar
- Success/failure count
- Summary statistics

### File Logging

All operations are automatically logged to a file:

- **Log file location**: `supabase-uploader.log` (configurable via `LOG_FILE` in `.env`)
- **Log format**: JSON-like entries with timestamp, level, and operation details
- **What's logged**:
  - File uploads (success/failure)
  - File downloads (success/failure)
  - File deletions
  - List operations
  - Errors and retries
  - Application startup

**View logs:**
```bash
# View last 20 entries in interactive mode
# Or manually:
tail -n 20 supabase-uploader.log

# View all logs
cat supabase-uploader.log
```

**Disable logging:**
Set `ENABLE_LOGGING=false` in your `.env` file

**Log file location:**
- Default: `supabase-uploader.log` in the script directory
- Custom: Set `LOG_FILE=/path/to/your/logfile.log` in `.env`

## Using as a Module

You can also import and use the functions in your own scripts:

```javascript
const { 
  uploadFile, 
  uploadMultipleFiles,
  uploadDirectory, 
  downloadFile,
  downloadMultipleFiles,
  listFiles,
  deleteFile,
  retryWithBackoff
} = require('./uploadToSupabase');

// Upload a file (with progress bar)
await uploadFile('./document.pdf', 'documents', 'myfolder/document.pdf');

// Batch upload
await uploadMultipleFiles(['file1.jpg', 'file2.jpg'], 'images', 'photos/');

// Upload a directory
await uploadDirectory('./myfolder', 'documents', 'base/path', true);

// Download a file
await downloadFile('images/photo.jpg', 'images', './downloads/photo.jpg');

// List files
await listFiles('documents', 'myfolder');
```

## Automation Examples

### Cron Job (Linux/Mac)

Add to crontab for daily uploads:

```bash
# Edit crontab
crontab -e

# Add this line (uploads every day at 2 AM)
0 2 * * * cd /path/to/SUPABASE-UPLOADER && node uploadToSupabase.js /path/to/backup.zip backups
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily)
4. Action: Start a program
5. Program: `node`
6. Arguments: `uploadToSupabase.js C:\path\to\file.pdf`

### Node.js Script Integration

```javascript
const { uploadFile } = require('./uploadToSupabase');

async function backupAndUpload() {
  // Your backup logic here
  const backupFile = './backup-' + Date.now() + '.zip';
  
  // Upload to Supabase
  const result = await uploadFile(backupFile, 'backups', `daily/${path.basename(backupFile)}`);
  
  if (result.success) {
    console.log('Backup uploaded:', result.publicUrl);
  }
}

backupAndUpload();
```

## Error Handling

The script includes comprehensive error handling:
- Validates environment variables on startup
- Checks if files exist before uploading
- Handles Supabase API errors gracefully
- Provides clear error messages

## Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use service_role key only on server** - Never expose it in client-side code
3. **Set appropriate bucket policies** - Use private buckets for sensitive files
4. **Rotate keys regularly** - Update your service_role key periodically

## Troubleshooting

### "Missing required environment variables"
- Make sure `.env` file exists and contains `SUPABASE_URL` and `SUPABASE_KEY`

### "File not found"
- Check that the file path is correct (use absolute paths if needed)

### "Bucket not found"
- Create the bucket in Supabase Dashboard first
- Check that the bucket name matches exactly

### "Permission denied"
- Ensure you're using the `service_role` key (not `anon` key)
- Check bucket policies in Supabase Dashboard

## License

MIT
