/**
 * Supabase File Uploader Script
 * 
 * This script allows you to push files to Supabase Storage buckets
 * Useful for automation on Hostinger VPS or any Node.js environment
 * 
 * Usage:
 *   node uploadToSupabase.js <file-path> [bucket-name] [storage-path]
 *   node uploadToSupabase.js --batch <file1> <file2> ... [bucket-name] [base-path]
 *   node uploadToSupabase.js --download <storage-path> [bucket-name] [local-path]
 * 
 * Example:
 *   node uploadToSupabase.js ./myfile.pdf documents myfolder/myfile.pdf
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const inquirer = require('inquirer');

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Use service_role key for server-side operations
const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET || 'files';
const MAX_RETRIES = process.env.MAX_RETRIES || 3;
const RETRY_DELAY_BASE = 1000; // Base delay in milliseconds
const LOG_FILE = process.env.LOG_FILE || 'supabase-uploader.log';
const ENABLE_LOGGING = process.env.ENABLE_LOGGING !== 'false'; // Default to true

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_KEY in your .env file');
  console.error('\nExample .env file:');
  console.error('SUPABASE_URL=https://your-project.supabase.co');
  console.error('SUPABASE_KEY=your-service-role-key');
  console.error('SUPABASE_BUCKET=files (optional)');
  console.error('MAX_RETRIES=3 (optional)');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize logging
if (ENABLE_LOGGING) {
  logInfo('Application started', {
    supabaseUrl: SUPABASE_URL,
    defaultBucket: DEFAULT_BUCKET,
    maxRetries: MAX_RETRIES,
    logFile: LOG_FILE
  });
}

/**
 * Logging utility functions
 */
function logToFile(level, message, data = null) {
  if (!ENABLE_LOGGING) return;
  
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    
    const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    // Silently fail if logging fails (don't break the main functionality)
    console.error(`Warning: Failed to write to log file: ${error.message}`);
  }
}

function logInfo(message, data = null) {
  logToFile('INFO', message, data);
}

function logError(message, data = null) {
  logToFile('ERROR', message, data);
}

function logSuccess(message, data = null) {
  logToFile('SUCCESS', message, data);
}

function logOperation(operation, details) {
  logInfo(`${operation}`, details);
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, operationName = 'Operation') {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt); // Exponential backoff
        console.log(`⚠️  ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ ${operationName} failed after ${maxRetries + 1} attempts`);
      }
    }
  }
  
  throw lastError;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Upload a single file to Supabase Storage with progress bar
 * @param {string} filePath - Local file path to upload
 * @param {string} bucketName - Supabase Storage bucket name
 * @param {string} storagePath - Path in the bucket (optional, defaults to filename)
 * @param {boolean} showProgress - Whether to show progress bar (default: true)
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(filePath, bucketName = DEFAULT_BUCKET, storagePath = null, showProgress = true) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileName = path.basename(filePath);
    const finalStoragePath = storagePath || fileName;

    // Create progress bar
    let progressBar;
    if (showProgress && fileSize > 1024) { // Only show progress for files > 1KB
      progressBar = new cliProgress.SingleBar({
        format: `📤 Uploading: ${fileName} |{bar}| {percentage}% | {value}/{total} ${formatFileSize(fileSize)} | ETA: {eta}s`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      progressBar.start(fileSize, 0);
    } else {
      console.log(`📤 Uploading: ${fileName} (${formatFileSize(fileSize)})`);
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    if (progressBar) {
      progressBar.update(fileSize); // Simulate progress (Supabase doesn't provide streaming progress)
    }

    // Upload file to Supabase Storage with retry logic
    const uploadResult = await retryWithBackoff(async () => {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(finalStoragePath, fileBuffer, {
          contentType: getContentType(filePath),
          upsert: true // Overwrite if file exists
        });

      if (error) {
        throw error;
      }

      return data;
    }, MAX_RETRIES, `Upload ${fileName}`);

    if (progressBar) {
      progressBar.stop();
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(finalStoragePath);

    console.log(`✅ Upload successful!`);
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   Storage Path: ${uploadResult.path}`);
    console.log(`   Public URL: ${urlData.publicUrl}`);
    console.log(`   Size: ${formatFileSize(fileSize)}`);

    logSuccess('File uploaded', {
      filePath,
      bucket: bucketName,
      storagePath: uploadResult.path,
      publicUrl: urlData.publicUrl,
      size: fileSize
    });

    return {
      success: true,
      path: uploadResult.path,
      id: uploadResult.id,
      publicUrl: urlData.publicUrl,
      size: fileSize
    };

  } catch (error) {
    console.error(`❌ Upload failed:`, error.message);
    logError('Upload failed', { filePath, bucket: bucketName, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload multiple files to Supabase Storage with batch progress
 * @param {Array<string>} filePaths - Array of local file paths
 * @param {string} bucketName - Supabase Storage bucket name
 * @param {string} baseStoragePath - Base path in bucket (optional)
 * @returns {Promise<Array>} Array of upload results
 */
async function uploadMultipleFiles(filePaths, bucketName = DEFAULT_BUCKET, baseStoragePath = '') {
  const results = [];
  const totalFiles = filePaths.length;
  
  // Create batch progress bar
  const batchProgressBar = new cliProgress.SingleBar({
    format: `📦 Batch Upload |{bar}| {percentage}% | {value}/{total} files | ETA: {eta}s`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  batchProgressBar.start(totalFiles, 0);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const fileName = path.basename(filePath);
    const storagePath = baseStoragePath 
      ? `${baseStoragePath}/${fileName}`.replace(/\/+/g, '/')
      : fileName;

    const result = await uploadFile(filePath, bucketName, storagePath, false); // Don't show individual progress bars
    results.push({ filePath, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    batchProgressBar.update(i + 1);
    
    // Small delay between uploads to avoid rate limiting
    if (i < filePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  batchProgressBar.stop();
  
  console.log(`\n📊 Batch Upload Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Total: ${totalFiles}`);

  return results;
}

/**
 * Upload all files from a directory
 * @param {string} dirPath - Directory path
 * @param {string} bucketName - Supabase Storage bucket name
 * @param {string} baseStoragePath - Base path in bucket (optional)
 * @param {boolean} recursive - Include subdirectories (default: false)
 * @returns {Promise<Array>} Array of upload results
 */
async function uploadDirectory(dirPath, bucketName = DEFAULT_BUCKET, baseStoragePath = '', recursive = false) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const files = [];
  
  function scanDirectory(currentPath, relativePath = '') {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        files.push({
          fullPath,
          relativePath: relativePath ? `${relativePath}/${item}` : item
        });
      } else if (stat.isDirectory() && recursive) {
        scanDirectory(fullPath, relativePath ? `${relativePath}/${item}` : item);
      }
    }
  }

  scanDirectory(dirPath);

  console.log(`📁 Found ${files.length} file(s) in directory`);

  // Use batch upload for directory
  const filePaths = files.map(f => f.fullPath);
  const results = await uploadMultipleFiles(filePaths, bucketName, baseStoragePath);

  // Map results back with relative paths
  return results.map((result, index) => ({
    ...result,
    relativePath: files[index].relativePath
  }));
}

/**
 * Download a file from Supabase Storage
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @param {string} localPath - Local path to save file (optional)
 * @returns {Promise<Object>} Download result
 */
async function downloadFile(storagePath, bucketName = DEFAULT_BUCKET, localPath = null) {
  try {
    const fileName = path.basename(storagePath);
    const finalLocalPath = localPath || fileName;

    console.log(`📥 Downloading: ${storagePath}`);
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   Saving to: ${finalLocalPath}`);

    // Download file with retry logic
    const fileData = await retryWithBackoff(async () => {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(storagePath);

      if (error) {
        throw error;
      }

      // Check if data is null/undefined
      if (!data) {
        throw new Error(`File not found or empty: ${storagePath}`);
      }

      return data;
    }, MAX_RETRIES, `Download ${storagePath}`);

    // Validate fileData before processing
    if (!fileData) {
      throw new Error(`No data received for: ${storagePath}`);
    }

    if (typeof fileData.arrayBuffer !== 'function') {
      throw new Error(`Invalid file data received for: ${storagePath}. Expected Blob, got ${typeof fileData}`);
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSize = buffer.length;

    if (fileSize === 0) {
      throw new Error(`Downloaded file is empty: ${storagePath}`);
    }

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: `📥 Downloading |{bar}| {percentage}% | {value}/{total} ${formatFileSize(fileSize)} | ETA: {eta}s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    progressBar.start(fileSize, 0);

    // Ensure directory exists (handle both absolute and relative paths)
    const dir = path.dirname(finalLocalPath);
    // Only create directory if it's not '.' (current directory) and different from the file path
    if (dir && dir !== '.' && dir !== finalLocalPath && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(finalLocalPath, buffer);
    
    progressBar.update(fileSize);
    progressBar.stop();

    console.log(`✅ Download successful!`);
    console.log(`   File: ${finalLocalPath}`);
    console.log(`   Size: ${formatFileSize(fileSize)}`);

    logSuccess('File downloaded', {
      storagePath,
      bucket: bucketName,
      localPath: finalLocalPath,
      size: fileSize
    });

    return {
      success: true,
      localPath: finalLocalPath,
      size: fileSize
    };

  } catch (error) {
    console.error(`❌ Download failed:`, error.message);
    
    // Provide helpful error messages
    if (error.statusCode || error.status) {
      console.error(`   Status: ${error.statusCode || error.status}`);
    }
    
    if (error.message && (
      error.message.includes('Object not found') || 
      error.message.includes('not found') ||
      error.message.includes('404')
    )) {
      console.error(`   Tip: Check that the file path '${storagePath}' exists in bucket '${bucketName}'`);
      console.error(`   Use --list to see available files: node uploadToSupabase.js --list ${bucketName}`);
    }
    
    if (error.message && error.message.includes('permission') || error.message.includes('403')) {
      console.error(`   Tip: Check that your service_role key has download permissions`);
      console.error(`   Verify bucket '${bucketName}' exists and is accessible`);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Download multiple files from Supabase Storage
 * @param {Array<string>} storagePaths - Array of storage paths
 * @param {string} bucketName - Bucket name
 * @param {string} localBasePath - Base local directory (optional)
 * @returns {Promise<Array>} Array of download results
 */
async function downloadMultipleFiles(storagePaths, bucketName = DEFAULT_BUCKET, localBasePath = '') {
  const results = [];
  const totalFiles = storagePaths.length;
  
  // Create batch progress bar
  const batchProgressBar = new cliProgress.SingleBar({
    format: `📥 Batch Download |{bar}| {percentage}% | {value}/{total} files | ETA: {eta}s`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  batchProgressBar.start(totalFiles, 0);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < storagePaths.length; i++) {
    const storagePath = storagePaths[i];
    const fileName = path.basename(storagePath);
    const localPath = localBasePath 
      ? path.join(localBasePath, fileName)
      : fileName;

    const result = await downloadFile(storagePath, bucketName, localPath);
    results.push({ storagePath, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    batchProgressBar.update(i + 1);
    
    // Small delay between downloads
    if (i < storagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  batchProgressBar.stop();
  
  console.log(`\n📊 Batch Download Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Total: ${totalFiles}`);

  return results;
}

/**
 * Get content type based on file extension
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.xml': 'application/xml'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * List files in a bucket
 * @param {string} bucketName - Bucket name
 * @param {string} folderPath - Folder path (optional)
 * @returns {Promise<Array>} List of files
 */
async function listFiles(bucketName = DEFAULT_BUCKET, folderPath = '') {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath);

    if (error) throw error;

    console.log(`📋 Files in bucket '${bucketName}'${folderPath ? ` (${folderPath})` : ''}:`);
    if (data.length === 0) {
      console.log('   (empty)');
    } else {
      data.forEach(file => {
        const size = file.metadata?.size || 0;
        console.log(`   - ${file.name} (${formatFileSize(size)})`);
      });
    }

    logInfo('Files listed', { bucket: bucketName, folderPath, count: data.length });
    return data;
  } catch (error) {
    console.error(`❌ Error listing files:`, error.message);
    logError('List files failed', { bucket: bucketName, folderPath, error: error.message });
    return [];
  }
}

/**
 * Delete a file from Supabase Storage
 * @param {string} storagePath - Path in bucket
 * @param {string} bucketName - Bucket name
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(storagePath, bucketName = DEFAULT_BUCKET) {
  try {
    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (error) {
        throw error;
      }

      return true;
    }, MAX_RETRIES, `Delete ${storagePath}`);

    console.log(`✅ Deleted: ${storagePath}`);
    logSuccess('File deleted', { storagePath, bucket: bucketName });
    return true;
  } catch (error) {
    console.error(`❌ Delete failed:`, error.message);
    logError('Delete failed', { storagePath, bucket: bucketName, error: error.message });
    return false;
  }
}

/**
 * Interactive CLI mode
 */
async function interactiveMode() {
  console.log('\n========================================');
  console.log('  Supabase File Uploader - Interactive Mode');
  console.log('========================================\n');
  
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'rawlist',
        name: 'action',
        message: 'What would you like to do? (Enter number)',
        prefix: '',
        choices: [
          { name: 'Upload File', value: 'upload' },
          { name: 'Upload Multiple Files', value: 'batch-upload' },
          { name: 'Upload Directory', value: 'upload-dir' },
          { name: 'Download File', value: 'download' },
          { name: 'Download Multiple Files', value: 'batch-download' },
          { name: 'List Files', value: 'list' },
          { name: 'Delete File', value: 'delete' },
          { name: 'View Log File', value: 'view-log' },
          { name: 'Exit', value: 'exit' }
        ],
        pageSize: 9
      }
    ]);

    if (action === 'exit') {
      console.log('\nGoodbye!\n');
      break;
    }

    try {
      switch (action) {
        case 'upload': {
          const { filePath, bucket, storagePath } = await inquirer.prompt([
            { type: 'input', name: 'filePath', message: 'File path to upload:' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'storagePath', message: 'Storage path (optional, press Enter to use filename):', default: '' }
          ]);
          await uploadFile(filePath, bucket, storagePath || null);
          break;
        }

        case 'batch-upload': {
          const { filePaths, bucket, basePath } = await inquirer.prompt([
            { type: 'input', name: 'filePaths', message: 'File paths (comma-separated):' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'basePath', message: 'Base storage path (optional):', default: '' }
          ]);
          const files = filePaths.split(',').map(f => f.trim()).filter(f => f);
          await uploadMultipleFiles(files, bucket, basePath);
          break;
        }

        case 'upload-dir': {
          const { dirPath, bucket, basePath } = await inquirer.prompt([
            { type: 'input', name: 'dirPath', message: 'Directory path:' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'basePath', message: 'Base storage path (optional):', default: '' }
          ]);
          await uploadDirectory(dirPath, bucket, basePath, true);
          break;
        }

        case 'download': {
          const { storagePath, bucket, localPath } = await inquirer.prompt([
            { type: 'input', name: 'storagePath', message: 'Storage path to download:' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'localPath', message: 'Local path to save (optional):', default: '' }
          ]);
          await downloadFile(storagePath, bucket, localPath || null);
          break;
        }

        case 'batch-download': {
          const { storagePaths, bucket, localDir } = await inquirer.prompt([
            { type: 'input', name: 'storagePaths', message: 'Storage paths (comma-separated):' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'localDir', message: 'Local directory (optional):', default: '' }
          ]);
          const paths = storagePaths.split(',').map(p => p.trim()).filter(p => p);
          await downloadMultipleFiles(paths, bucket, localDir);
          break;
        }

        case 'list': {
          const { bucket, folderPath } = await inquirer.prompt([
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET },
            { type: 'input', name: 'folderPath', message: 'Folder path (optional):', default: '' }
          ]);
          await listFiles(bucket, folderPath);
          break;
        }

        case 'delete': {
          const { storagePath, bucket } = await inquirer.prompt([
            { type: 'input', name: 'storagePath', message: 'Storage path to delete:' },
            { type: 'input', name: 'bucket', message: 'Bucket name:', default: DEFAULT_BUCKET }
          ]);
          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Are you sure you want to delete "${storagePath}"?`, default: false }
          ]);
          if (confirm) {
            await deleteFile(storagePath, bucket);
          } else {
            console.log('Deletion cancelled');
          }
          break;
        }

        case 'view-log': {
          if (fs.existsSync(LOG_FILE)) {
            const logContent = fs.readFileSync(LOG_FILE, 'utf8');
            const lines = logContent.split('\n').filter(l => l.trim());
            console.log(`\nLast 20 log entries:\n`);
            lines.slice(-20).forEach(line => console.log(line));
            console.log(`\nFull log file: ${path.resolve(LOG_FILE)}\n`);
          } else {
            console.log(`\nNo log file found at: ${LOG_FILE}\n`);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
      logError('Interactive mode error', { action, error: error.message });
    }

    // Ask if user wants to continue
    const { continue: shouldContinue } = await inquirer.prompt([
      { type: 'confirm', name: 'continue', message: '\nContinue?', default: true }
    ]);

    if (!shouldContinue) {
      console.log('\nGoodbye!\n');
      break;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  // Handle interactive mode
  if (args.length === 0 || args[0] === '--interactive' || args[0] === '-i') {
    await interactiveMode();
    return;
  }

  if (args.length === 0) {
    console.log('📦 Supabase File Uploader');
    console.log('\nUsage:');
    console.log('  Interactive Mode:');
    console.log('    node uploadToSupabase.js --interactive');
    console.log('    node uploadToSupabase.js -i');
    console.log('  Upload:');
    console.log('    node uploadToSupabase.js <file-path> [bucket-name] [storage-path]');
    console.log('    node uploadToSupabase.js --batch <file1> <file2> ... [bucket-name] [base-path]');
    console.log('  Download:');
    console.log('    node uploadToSupabase.js --download <storage-path> [bucket-name] [local-path]');
    console.log('    node uploadToSupabase.js --download-batch <path1> <path2> ... [bucket-name] [local-dir]');
    console.log('  Other:');
    console.log('    node uploadToSupabase.js --list [bucket-name] [folder-path]');
    console.log('    node uploadToSupabase.js --delete <storage-path> [bucket-name]');
    console.log('\nExamples:');
    console.log('  node uploadToSupabase.js ./document.pdf');
    console.log('  node uploadToSupabase.js ./document.pdf documents');
    console.log('  node uploadToSupabase.js --batch file1.jpg file2.jpg file3.jpg images');
    console.log('  node uploadToSupabase.js --download images/photo.jpg images ./downloads/');
    console.log('  node uploadToSupabase.js --list');
    console.log('  node uploadToSupabase.js --delete myfolder/document.pdf');
    process.exit(0);
  }

  // Handle list command
  if (args[0] === '--list') {
    const bucketName = args[1] || DEFAULT_BUCKET;
    const folderPath = args[2] || '';
    await listFiles(bucketName, folderPath);
    return;
  }

  // Handle delete command
  if (args[0] === '--delete') {
    if (!args[1]) {
      console.error('❌ Error: Storage path required for delete');
      process.exit(1);
    }
    const storagePath = args[1];
    const bucketName = args[2] || DEFAULT_BUCKET;
    await deleteFile(storagePath, bucketName);
    return;
  }

  // Handle batch upload
  if (args[0] === '--batch') {
    if (args.length < 2) {
      console.error('❌ Error: At least one file path required for batch upload');
      process.exit(1);
    }
    
    // Find where bucket name starts (first arg that doesn't look like a file path)
    let bucketIndex = args.length;
    let basePath = '';
    
    // Check if last arg is a path (contains / or \)
    if (args.length >= 2 && (args[args.length - 1].includes('/') || args[args.length - 1].includes('\\'))) {
      basePath = args[args.length - 1];
      bucketIndex = args.length - 1;
    }
    
    // Check if second-to-last is bucket name
    if (args.length >= 3 && !args[args.length - 2].includes('/') && !args[args.length - 2].includes('\\')) {
      bucketIndex = args.length - 2;
    }
    
    const filePaths = args.slice(1, bucketIndex);
    const bucketName = bucketIndex < args.length ? args[bucketIndex] : DEFAULT_BUCKET;
    
    await uploadMultipleFiles(filePaths, bucketName, basePath);
    return;
  }

  // Handle batch download
  if (args[0] === '--download-batch') {
    if (args.length < 2) {
      console.error('❌ Error: At least one storage path required for batch download');
      process.exit(1);
    }
    
    // Similar logic to batch upload
    let bucketIndex = args.length;
    let localDir = '';
    
    if (args.length >= 2 && (args[args.length - 1].includes('/') || args[args.length - 1].includes('\\'))) {
      localDir = args[args.length - 1];
      bucketIndex = args.length - 1;
    }
    
    if (args.length >= 3 && !args[args.length - 2].includes('/') && !args[args.length - 2].includes('\\')) {
      bucketIndex = args.length - 2;
    }
    
    const storagePaths = args.slice(1, bucketIndex);
    const bucketName = bucketIndex < args.length ? args[bucketIndex] : DEFAULT_BUCKET;
    
    await downloadMultipleFiles(storagePaths, bucketName, localDir);
    return;
  }

  // Handle single download
  if (args[0] === '--download') {
    if (!args[1]) {
      console.error('❌ Error: Storage path required for download');
      process.exit(1);
    }
    const storagePath = args[1];
    
    // Smart argument parsing: if args[2] looks like a path (contains / or \), it's localPath
    // Otherwise, args[2] is bucketName and args[3] is localPath
    let bucketName = DEFAULT_BUCKET;
    let localPath = null;
    
    if (args[2]) {
      if (args[2].includes('/') || args[2].includes('\\') || args[2].startsWith('.')) {
        // args[2] is a local path
        localPath = args[2];
      } else {
        // args[2] is bucket name
        bucketName = args[2];
        localPath = args[3] || null;
      }
    }
    
    await downloadFile(storagePath, bucketName, localPath);
    return;
  }

  // Handle single upload
  const filePath = args[0];
  const bucketName = args[1] || DEFAULT_BUCKET;
  const storagePath = args[2] || null;

  // Check if it's a directory
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    console.log(`📁 Uploading directory: ${filePath}`);
    await uploadDirectory(filePath, bucketName, storagePath, true);
  } else {
    await uploadFile(filePath, bucketName, storagePath);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

// Export functions for use as a module
module.exports = {
  uploadFile,
  uploadMultipleFiles,
  uploadDirectory,
  downloadFile,
  downloadMultipleFiles,
  listFiles,
  deleteFile,
  retryWithBackoff,
  interactiveMode,
  logInfo,
  logError,
  logSuccess
};
