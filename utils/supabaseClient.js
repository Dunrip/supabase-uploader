/**
 * Shared Supabase client for server-side API routes
 * Centralizes Supabase client creation to avoid duplication
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client instance
 * @returns {SupabaseClient} Configured Supabase client
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}
