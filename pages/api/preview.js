import path from 'path';
import { getSupabaseClient } from '../../utils/supabaseClient';
import { getDefaultBucket } from '../../utils/serverHelpers';

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

  try {
    const supabase = getSupabaseClient();

    // Try to get the file from storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (error) {
      console.error('Preview download error:', error);
      
      // Provide more specific error messages
      if (error.message && error.message.includes('Bucket not found')) {
        return res.status(404).json({
          success: false,
          error: `Bucket "${bucketName}" not found. Please check the bucket name.`,
        });
      }
      
      if (error.message && (error.message.includes('Object not found') || error.message.includes('not found'))) {
        return res.status(404).json({
          success: false,
          error: `File "${storagePath}" not found in bucket "${bucketName}"`,
        });
      }
      
      return res.status(404).json({
        success: false,
        error: error.message || 'File not found',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Get file extension to determine content type
    const ext = path.extname(storagePath).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(storagePath)}"`);

    res.send(buffer);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview file',
    });
  }
}
