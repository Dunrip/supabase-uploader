import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName, validateFilename } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

async function handler(req, res) {
  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  if (req.method === 'POST') {
    // Create folder
    const { folderName, parentPath, bucket } = req.body;

    // Validate bucket
    const bucketName = bucket || settings.default_bucket || 'files';
    const bucketValidation = validateBucketName(bucketName);
    if (!bucketValidation.valid) {
      return sendError(res, bucketValidation.error, 400);
    }

    // Validate folder name
    if (!folderName || typeof folderName !== 'string') {
      return sendError(res, 'Folder name is required', 400);
    }

    const folderNameValidation = validateFilename(folderName.trim());
    if (!folderNameValidation.valid) {
      return sendError(res, folderNameValidation.error, 400);
    }

    // Validate parent path if provided
    let sanitizedParentPath = '';
    if (parentPath) {
      const parentValidation = validateStoragePath(parentPath);
      if (!parentValidation.valid) {
        return sendError(res, parentValidation.error, 400);
      }
      sanitizedParentPath = parentValidation.sanitized;
    }

    // Build full folder path
    const fullPath = sanitizedParentPath
      ? `${sanitizedParentPath}/${folderNameValidation.sanitized}`
      : folderNameValidation.sanitized;

    try {
      // Supabase doesn't have a native "create folder" operation
      // We create a folder by uploading a placeholder file (.folder)
      const placeholderPath = `${fullPath}/.folder`;

      // Use Buffer instead of Blob for Node.js server-side
      const placeholderContent = Buffer.from('', 'utf-8');

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(placeholderPath, placeholderContent, {
          contentType: 'text/plain',
          upsert: false,
        });

      if (error) {
        if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
          return sendError(res, 'A folder with this name already exists', 409);
        }
        throw error;
      }

      return sendSuccess(res, {
        message: 'Folder created successfully',
        path: fullPath,
      });
    } catch (error) {
      console.error('Create folder error:', error);
      return sendError(res, error.message || 'Failed to create folder', 500);
    }
  } else if (req.method === 'DELETE') {
    // Delete folder recursively
    const { path, bucket } = req.query;

    if (!path) {
      return sendError(res, 'Folder path is required', 400);
    }

    // Validate bucket
    const bucketName = bucket || settings.default_bucket || 'files';
    const bucketValidation = validateBucketName(bucketName);
    if (!bucketValidation.valid) {
      return sendError(res, bucketValidation.error, 400);
    }

    // Validate folder path
    const pathValidation = validateStoragePath(path);
    if (!pathValidation.valid) {
      return sendError(res, pathValidation.error, 400);
    }

    try {
      // List all files in the folder recursively
      const allFiles = [];
      const listRecursively = async (folderPath) => {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list(folderPath);

        if (error) throw error;

        for (const item of data || []) {
          const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

          if (item.id === null) {
            // It's a folder, recurse into it
            await listRecursively(itemPath);
          } else {
            // It's a file
            allFiles.push(itemPath);
          }
        }
      };

      await listRecursively(pathValidation.sanitized);

      if (allFiles.length === 0) {
        return sendError(res, 'Folder is empty or does not exist', 404);
      }

      // Delete all files in the folder
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove(allFiles);

      if (deleteError) throw deleteError;

      return sendSuccess(res, {
        message: `Folder deleted successfully (${allFiles.length} items)`,
        deletedCount: allFiles.length,
      });
    } catch (error) {
      console.error('Delete folder error:', error);
      return sendError(res, error.message || 'Failed to delete folder', 500);
    }
  } else {
    return validateMethod(req, res, ['POST', 'DELETE']);
  }
}

export default withAuth(handler);
