import { IncomingForm } from 'formidable';
import { uploadFile, listFiles } from '../../uploadToSupabase';
import { getTempDir, getDefaultBucket, cleanupTempFile, withTimeout } from '../../utils/serverHelpers';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName, validateFileType, validateFilename } from '../../utils/security';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const UPLOAD_TIMEOUT = 300000; // 5 minutes

/**
 * Generate a unique filename by appending (2), (3), etc. if the file already exists
 * @param {string} fileName - Original filename
 * @param {Array<string>} existingFiles - Array of existing filenames in the bucket
 * @returns {string} Unique filename
 */
function generateUniqueFileName(fileName, existingFiles) {
  // Extract name and extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  
  // Check if the original filename exists
  if (!existingFiles.includes(fileName)) {
    return fileName;
  }
  
  // Try (2), (3), etc. until we find a unique name
  let counter = 2;
  let newFileName;
  do {
    newFileName = `${nameWithoutExt}(${counter})${extension}`;
    counter++;
  } while (existingFiles.includes(newFileName) && counter < 1000); // Safety limit
  
  return newFileName;
}

export default async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  let uploadedFile = null;

  try {
    const uploadDir = getTempDir();

    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
    });

    const formData = await form.parse(req);
    const fields = formData[0] || {};
    const files = formData[1] || {};
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return sendError(res, 'No file provided', 400);
    }

    uploadedFile = file;

    // Validate filename
    const filenameValidation = validateFilename(file.originalFilename);
    if (!filenameValidation.valid) {
      cleanupTempFile(file.filepath);
      return sendError(res, filenameValidation.error, 400);
    }

    // Validate file type (magic bytes check)
    const fileTypeValidation = await validateFileType(file.filepath, file.originalFilename);
    if (!fileTypeValidation.valid) {
      cleanupTempFile(file.filepath);
      return sendError(res, fileTypeValidation.error, 400);
    }

    // Validate bucket name
    const bucketName = fields.bucket?.[0] || getDefaultBucket();
    const bucketValidation = validateBucketName(bucketName);
    if (!bucketValidation.valid) {
      cleanupTempFile(file.filepath);
      return sendError(res, bucketValidation.error, 400);
    }

    // Validate and sanitize storage path
    let storagePath = fields.path?.[0] || file.originalFilename || null;
    if (fields.path?.[0]) {
      const pathValidation = validateStoragePath(fields.path[0]);
      if (!pathValidation.valid) {
        cleanupTempFile(file.filepath);
        return sendError(res, pathValidation.error, 400);
      }
      storagePath = pathValidation.sanitized;
    }
    
    // Check for duplicate filenames and rename if necessary
    if (storagePath && !fields.path?.[0]) {
      // Only auto-rename if no custom path was provided
      try {
        const existingFiles = await listFiles(bucketName, '');
        // Filter out folders - folders don't have metadata property
        const existingFileNames = existingFiles
          .filter(f => f.metadata !== null && f.metadata !== undefined)
          .map(f => f.name);
        const originalFileName = storagePath;
        storagePath = generateUniqueFileName(originalFileName, existingFileNames);
      } catch (error) {
        // Continue with original filename if listing fails
      }
    }

    const uploadPromise = uploadFile(file.filepath, bucketName, storagePath, false);
    const result = await withTimeout(
      uploadPromise,
      UPLOAD_TIMEOUT,
      'Upload timeout - file may be too large or connection is slow'
    );

    cleanupTempFile(file.filepath);

    if (!result?.success) {
      throw new Error(result?.error || 'Upload failed');
    }

    sendSuccess(res, result);
  } catch (error) {
    console.error(`❌ Upload failed:`, error);

    if (uploadedFile?.filepath) {
      cleanupTempFile(uploadedFile.filepath);
    }

    sendError(res, error.message || 'Upload failed. Please check server logs.', 500);
  }
}
