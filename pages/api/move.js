import path from 'path';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  const { sourcePath, destinationFolder, bucket } = req.body;

  // Validate source path
  if (!sourcePath) {
    return sendError(res, 'Source path is required', 400);
  }

  const sourceValidation = validateStoragePath(sourcePath);
  if (!sourceValidation.valid) {
    return sendError(res, sourceValidation.error, 400);
  }

  // Validate destination folder (can be empty string for root)
  let sanitizedDestFolder = '';
  if (destinationFolder && destinationFolder !== '/') {
    const destValidation = validateStoragePath(destinationFolder);
    if (!destValidation.valid) {
      return sendError(res, destValidation.error, 400);
    }
    sanitizedDestFolder = destValidation.sanitized;
  }

  // Validate bucket
  const bucketName = bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  const sanitizedSourcePath = sourceValidation.sanitized;
  const fileName = path.basename(sanitizedSourcePath);

  // Build destination path
  const destinationPath = sanitizedDestFolder
    ? `${sanitizedDestFolder}/${fileName}`
    : fileName;

  // Check if source and destination are the same
  if (sanitizedSourcePath === destinationPath) {
    return sendError(res, 'Source and destination are the same', 400);
  }

  try {

    // Check if file with same name already exists at destination
    const destFolder = sanitizedDestFolder || '';
    const { data: existingFiles } = await supabase.storage
      .from(bucketName)
      .list(destFolder, { limit: 1, search: fileName });

    if (existingFiles && existingFiles.some(f => f.name === fileName)) {
      return sendError(res, 'A file with this name already exists at the destination', 409);
    }

    // Supabase doesn't have a native move operation
    // We need to: 1) Download, 2) Upload to new location, 3) Delete old file

    // Step 1: Download the original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(sanitizedSourcePath);

    if (downloadError) {
      console.error('Download error during move:', downloadError);
      return sendError(res, 'Failed to access source file', 500);
    }

    if (!fileData) {
      return sendError(res, 'Source file not found', 404);
    }

    // Step 2: Upload to new location
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(destinationPath, buffer, {
        contentType: fileData.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error during move:', uploadError);
      return sendError(res, uploadError.message || 'Failed to move file', 500);
    }

    // Step 3: Delete the old file
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([sanitizedSourcePath]);

    if (deleteError) {
      // Try to clean up the new file since deletion failed
      console.error('Delete error during move:', deleteError);
      await supabase.storage.from(bucketName).remove([destinationPath]);
      return sendError(res, 'Failed to complete move operation', 500);
    }

    return sendSuccess(res, {
      message: 'File moved successfully',
      sourcePath: sanitizedSourcePath,
      destinationPath: destinationPath,
    });
  } catch (error) {
    console.error('Move error:', error);
    return sendError(res, error.message || 'Failed to move file', 500);
  }
}

export default withAuth(handler);
