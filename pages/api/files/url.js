import { getSupabaseClient } from '../../../utils/supabaseClient';
import { getDefaultBucket } from '../../../utils/serverHelpers';

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

    // Try to get public URL first
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    // Always use preview endpoint for reliability (works with both public and private buckets)
    // The preview endpoint will handle file access properly
    res.json({
      success: true,
      url: `/api/preview?path=${encodeURIComponent(storagePath)}&bucket=${encodeURIComponent(bucketName)}`,
    });
  } catch (error) {
    console.error('Get URL error:', error);
    // Fallback to preview endpoint on any error
    res.json({
      success: true,
      url: `/api/preview?path=${encodeURIComponent(storagePath)}&bucket=${encodeURIComponent(bucketName)}`,
    });
  }
}
