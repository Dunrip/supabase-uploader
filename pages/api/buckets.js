import { getSupabaseClient } from '../../utils/supabaseClient';
import { getDefaultBucket } from '../../utils/serverHelpers';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';

export default async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  try {
    const supabase = getSupabaseClient();

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) throw error;

    sendSuccess(res, {
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
    sendError(res, error.message || 'Failed to list buckets', 500);
  }
}
