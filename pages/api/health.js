import { getSupabaseClient } from '../../utils/supabaseClient';
import { getDefaultBucket } from '../../utils/serverHelpers';
import { sendSuccess, sendError } from '../../utils/apiHelpers';

/**
 * Health check endpoint
 * Returns server status and Supabase connection status
 * Useful for monitoring and load balancers
 */
export default async function handler(req, res) {
  const startTime = Date.now();

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      server: { status: 'ok' },
      supabase: { status: 'unknown' },
    },
  };

  try {
    // Check Supabase connection by listing buckets
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      health.checks.supabase = {
        status: 'error',
        error: error.message,
      };
      health.status = 'degraded';
    } else {
      health.checks.supabase = {
        status: 'ok',
        bucketCount: data?.length || 0,
        defaultBucket: getDefaultBucket(),
      };
    }
  } catch (error) {
    health.checks.supabase = {
      status: 'error',
      error: error.message,
    };
    health.status = 'degraded';
  }

  health.responseTime = `${Date.now() - startTime}ms`;

  // Return 200 even if degraded (for monitoring purposes)
  // Use 503 only if completely down
  const statusCode = health.status === 'ok' ? 200 : 200;

  return res.status(statusCode).json(health);
}
