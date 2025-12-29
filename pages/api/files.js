import { listFiles, deleteFile } from '../../uploadToSupabase';
import { formatFileSize } from '../../utils/clientHelpers';
import { getDefaultBucket } from '../../utils/serverHelpers';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const bucketName = req.query.bucket || getDefaultBucket();
      const folderPath = req.query.folder || '';

      const files = await listFiles(bucketName, folderPath);

      const formattedFiles = files.map(file => ({
        name: file.name,
        size: file.metadata?.size || 0,
        sizeFormatted: formatFileSize(file.metadata?.size || 0),
        updatedAt: file.updated_at,
        createdAt: file.created_at,
        path: folderPath ? `${folderPath}/${file.name}` : file.name,
      }));

      res.json({
        success: true,
        files: formattedFiles,
        bucket: bucketName,
        folder: folderPath,
      });
    } catch (error) {
      console.error('❌ Error listing files:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list files',
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const storagePath = req.query.path;
      const bucketName = req.query.bucket || getDefaultBucket();

      if (!storagePath) {
        return res.status(400).json({
          success: false,
          error: 'Storage path required',
        });
      }

      const success = await deleteFile(storagePath, bucketName);

      res.json({
        success,
        message: success ? 'File deleted successfully' : 'Failed to delete file',
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  } else {
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
