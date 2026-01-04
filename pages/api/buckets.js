import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) throw error;

    sendSuccess(res, {
      buckets: buckets.map(b => ({
        name: b.name,
        id: b.id,
        public: b.public,
        createdAt: b.created_at,
      })),
      default: settings.default_bucket || 'files',
    });
  } catch (error) {
    console.error('Error listing buckets:', error);
    sendError(res, error.message || 'Failed to list buckets', 500);
  }
}

export default withAuth(handler);
