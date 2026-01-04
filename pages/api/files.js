import { listFiles, deleteFile } from '../../uploadToSupabase';
import { formatFileSize } from '../../utils/clientHelpers';
import { getDefaultBucket } from '../../utils/serverHelpers';
import { validateMethod, validateQueryParams, sendSuccess, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Validate bucket name
      const bucketName = req.query.bucket || getDefaultBucket();
      const bucketValidation = validateBucketName(bucketName);
      if (!bucketValidation.valid) {
        return sendError(res, bucketValidation.error, 400);
      }

      // Validate folder path if provided
      let folderPath = '';
      if (req.query.folder) {
        const pathValidation = validateStoragePath(req.query.folder);
        if (!pathValidation.valid) {
          return sendError(res, pathValidation.error, 400);
        }
        folderPath = pathValidation.sanitized;
      }

      const items = await listFiles(bucketName, folderPath);

      // Separate folders and files
      const folders = [];
      const files = [];

      items.forEach(item => {
        // In Supabase, folders have id: null
        if (item.id === null) {
          // It's a folder
          folders.push({
            name: item.name,
            isFolder: true,
            path: folderPath ? `${folderPath}/${item.name}` : item.name,
            updatedAt: item.updated_at,
            createdAt: item.created_at,
          });
        } else {
          // It's a file - skip .folder placeholder files
          if (item.name !== '.folder') {
            files.push({
              name: item.name,
              isFolder: false,
              size: item.metadata?.size || 0,
              sizeFormatted: formatFileSize(item.metadata?.size || 0),
              updatedAt: item.updated_at,
              createdAt: item.created_at,
              path: folderPath ? `${folderPath}/${item.name}` : item.name,
            });
          }
        }
      });

      sendSuccess(res, {
        folders,
        files,
        bucket: bucketName,
        folder: folderPath,
      });
    } catch (error) {
      console.error('❌ Error listing files:', error);
      sendError(res, error.message || 'Failed to list files', 500);
    }
  } else if (req.method === 'DELETE') {
    try {
      if (!validateQueryParams(req, res, ['path'])) return;

      // Validate storage path (prevent path traversal)
      const pathValidation = validateStoragePath(req.query.path);
      if (!pathValidation.valid) {
        return sendError(res, pathValidation.error, 400);
      }
      const storagePath = pathValidation.sanitized;

      // Validate bucket name
      const bucketName = req.query.bucket || getDefaultBucket();
      const bucketValidation = validateBucketName(bucketName);
      if (!bucketValidation.valid) {
        return sendError(res, bucketValidation.error, 400);
      }

      const success = await deleteFile(storagePath, bucketName);

      sendSuccess(res, {
        message: success ? 'File deleted successfully' : 'Failed to delete file',
      });
    } catch (error) {
      console.error('Delete error:', error);
      sendError(res, error.message, 500);
    }
  } else {
    validateMethod(req, res, ['GET', 'DELETE']);
  }
}
