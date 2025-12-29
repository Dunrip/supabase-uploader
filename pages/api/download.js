import path from 'path';
import fs from 'fs';
import { downloadFile } from '../../uploadToSupabase';
import { getTempDir, getDefaultBucket, cleanupTempFile } from '../../utils/serverHelpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const storagePath = req.query.path;
  const bucketName = req.query.bucket || getDefaultBucket();

  if (!storagePath) {
    return res.status(400).json({
      success: false,
      error: 'Storage path required',
    });
  }

  const fileName = path.basename(storagePath);
  const localPath = path.join(getTempDir(), fileName);
  let fileStream = null;

  try {
    const result = await downloadFile(storagePath, bucketName, localPath);

    if (!result?.success) {
      return res.status(404).json(result || { success: false, error: 'File not found' });
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ success: false, error: 'Downloaded file not found' });
    }

    // Properly escape filename for Content-Disposition header
    // RFC 5987: Use both filename and filename* for maximum compatibility
    const safeFileName = fileName.replace(/"/g, '\\"').replace(/\n/g, '');
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => cleanupTempFile(localPath));
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      cleanupTempFile(localPath);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to stream file' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    cleanupTempFile(localPath);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
