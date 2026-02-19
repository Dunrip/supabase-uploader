import { IncomingForm } from 'formidable';
import { uploadFile, checkFileExists } from '../../utils/storageOperations.js';
import { getTempDir, cleanupTempFile, withTimeout } from '../../utils/serverHelpers';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName, validateFileType, validateFilename } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';
import { enforceStorageQuota, enforceBandwidthQuota } from '../../utils/quota.js';
import { emitUploadEvent } from '../../utils/eventPipeline.mjs';
import { appendAuditEvent, buildAuditEventFromRequest } from '../../utils/auditLog.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const UPLOAD_TIMEOUT = 300000; // 5 minutes

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  let uploadedFile = null;
  let eventContext = {};

  try {
    const uploadDir = await getTempDir();

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

    if (!await enforceStorageQuota(req, res, supabase, fields.bucket?.[0] || settings.default_bucket || 'files', file.size || 0)) {
      await cleanupTempFile(file.filepath);
      return;
    }

    if (!enforceBandwidthQuota(req, res, file.size || 0)) {
      await cleanupTempFile(file.filepath);
      return;
    }

    // Validate filename
    const filenameValidation = validateFilename(file.originalFilename);
    if (!filenameValidation.valid) {
      await cleanupTempFile(file.filepath);
      return sendError(res, filenameValidation.error, 400);
    }

    // Validate file type (magic bytes check)
    const fileTypeValidation = await validateFileType(file.filepath, file.originalFilename);
    if (!fileTypeValidation.valid) {
      await cleanupTempFile(file.filepath);
      return sendError(res, fileTypeValidation.error, 400);
    }

    // Validate bucket name
    const bucketName = fields.bucket?.[0] || settings.default_bucket || 'files';
    const bucketValidation = validateBucketName(bucketName);
    if (!bucketValidation.valid) {
      await cleanupTempFile(file.filepath);
      return sendError(res, bucketValidation.error, 400);
    }

    // Validate and sanitize storage path
    let storagePath = fields.path?.[0] || file.originalFilename || null;
    if (fields.path?.[0]) {
      const pathValidation = validateStoragePath(fields.path[0]);
      if (!pathValidation.valid) {
        await cleanupTempFile(file.filepath);
        return sendError(res, pathValidation.error, 400);
      }
      storagePath = pathValidation.sanitized;
    }

    // Check for duplicate filenames and rename if necessary
    if (storagePath && !fields.path?.[0]) {
      // Only auto-rename if no custom path was provided
      try {
        const originalFileName = storagePath;

        // Efficiently check if file exists and find a unique name
        if (await checkFileExists(supabase, bucketName, originalFileName)) {
          // Extract name and extension
          const lastDotIndex = originalFileName.lastIndexOf('.');
          const nameWithoutExt = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
          const extension = lastDotIndex > 0 ? originalFileName.substring(lastDotIndex) : '';

          let counter = 2;
          let newFileName;
          let found = false;

          while (!found && counter < 1000) {
            newFileName = `${nameWithoutExt}(${counter})${extension}`;
            const exists = await checkFileExists(supabase, bucketName, newFileName);
            if (!exists) {
              found = true;
              storagePath = newFileName;
            }
            counter++;
          }
        }
      } catch (error) {
        // Continue with original filename if checking fails
        console.error('Error checking for duplicates:', error);
      }
    }

    eventContext = {
      userId: req.user?.id,
      bucket: bucketName,
      path: storagePath,
      originalFilename: file.originalFilename,
      size: file.size,
    };

    await emitUploadEvent('upload.started', eventContext);

    const uploadPromise = uploadFile(supabase, file.filepath, bucketName, storagePath, settings.max_retries);
    const result = await withTimeout(
      uploadPromise,
      UPLOAD_TIMEOUT,
      'Upload timeout - file may be too large or connection is slow'
    );

    await cleanupTempFile(file.filepath);

    if (!result?.success) {
      throw new Error(result?.error || 'Upload failed');
    }

    await emitUploadEvent('upload.completed', {
      ...eventContext,
      uploadedPath: result.path,
      publicUrl: result.publicUrl,
      completedAt: new Date().toISOString(),
    });

    appendAuditEvent(buildAuditEventFromRequest(req, {
      action: 'upload_file',
      resource: 'storage_object',
      bucket: bucketName,
      path: storagePath,
      bytes: file.size || 0,
      status: 'success',
    }));

    sendSuccess(res, result);
  } catch (error) {
    console.error('Upload failed:', error);

    if (uploadedFile?.filepath) {
      await cleanupTempFile(uploadedFile.filepath);
    }

    await emitUploadEvent('upload.failed', {
      ...eventContext,
      error: error.message || 'Unknown upload error',
      failedAt: new Date().toISOString(),
    });

    appendAuditEvent(buildAuditEventFromRequest(req, {
      action: 'upload_file',
      resource: 'storage_object',
      status: 'error',
      error: error.message,
    }));

    sendError(res, error.message || 'Upload failed. Please check server logs.', 500);
  }
}

// Skip CSRF for file uploads - multipart form data doesn't support custom headers easily
// Authentication is still required and provides sufficient protection
export default withAuth(handler, { skipCsrf: true, rolesAllowed: ['operator', 'admin'] });
