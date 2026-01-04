import path from 'path';
import { validateMethod, sendError, sendSuccess } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName, validateFilename } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  const { oldPath, newName, bucket } = req.body;

  // Validate old path
  if (!oldPath) {
    return sendError(res, 'Old path is required', 400);
  }

  const oldPathValidation = validateStoragePath(oldPath);
  if (!oldPathValidation.valid) {
    return sendError(res, oldPathValidation.error, 400);
  }

  // Validate new name
  if (!newName || typeof newName !== 'string') {
    return sendError(res, 'New name is required', 400);
  }

  const newNameValidation = validateFilename(newName.trim());
  if (!newNameValidation.valid) {
    return sendError(res, newNameValidation.error, 400);
  }

  // Validate bucket name
  const bucketName = bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  const sanitizedOldPath = oldPathValidation.sanitized;
  const sanitizedNewName = newNameValidation.sanitized;

  // Calculate new path (keep the directory, change the filename)
  const directory = path.dirname(sanitizedOldPath);
  const newPath = directory === '.' ? sanitizedNewName : `${directory}/${sanitizedNewName}`;

  // Validate the new path as well
  const newPathValidation = validateStoragePath(newPath);
  if (!newPathValidation.valid) {
    return sendError(res, newPathValidation.error, 400);
  }

  // Check if old and new paths are the same
  if (sanitizedOldPath === newPath) {
    return sendError(res, 'New name is the same as the old name', 400);
  }

  try {
    // Check if a file with the new name already exists
    const { data: existingFile } = await supabase.storage
      .from(bucketName)
      .list(directory === '.' ? '' : directory, {
        limit: 1,
        search: sanitizedNewName,
      });

    // Check for exact match (case-insensitive check is safer)
    if (existingFile && existingFile.some(f => f.name.toLowerCase() === sanitizedNewName.toLowerCase())) {
      return sendError(res, 'A file with this name already exists', 409);
    }

    // Supabase doesn't have a direct rename operation
    // We need to: 1) Download the file, 2) Upload with new name, 3) Delete old file

    // Step 1: Download the original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(sanitizedOldPath);

    if (downloadError) {
      console.error('Download error during rename:', downloadError);
      return sendError(res, 'Failed to access original file', 500);
    }

    if (!fileData) {
      return sendError(res, 'Original file not found', 404);
    }

    // Step 2: Upload with new name
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(newPath, buffer, {
        contentType: fileData.type,
        upsert: false, // Don't overwrite if exists (extra safety)
      });

    if (uploadError) {
      console.error('Upload error during rename:', uploadError);
      return sendError(res, uploadError.message || 'Failed to create renamed file', 500);
    }

    // Step 3: Delete the old file
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([sanitizedOldPath]);

    if (deleteError) {
      // Try to clean up the new file since deletion failed
      console.error('Delete error during rename:', deleteError);
      await supabase.storage.from(bucketName).remove([newPath]);
      return sendError(res, 'Failed to complete rename operation', 500);
    }

    return sendSuccess(res, {
      message: 'File renamed successfully',
      oldPath: sanitizedOldPath,
      newPath: newPath,
      newName: sanitizedNewName,
    });
  } catch (error) {
    console.error('Rename error:', error);
    return sendError(res, error.message || 'Failed to rename file', 500);
  }
}

export default withAuth(handler);
