import { getSupabaseClient } from '../../utils/supabaseClient';
import { getDefaultBucket } from '../../utils/serverHelpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) throw error;

    res.json({
      success: true,
      buckets: buckets.map(b => ({
        name: b.name,
        id: b.id,
        public: b.public,
        createdAt: b.created_at,
      })),
      default: getDefaultBucket(),
    });
  } catch (error) {
    console.error('❌ Error listing buckets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list buckets',
    });
  }
}
