/**
 * Shared Supabase client for server-side API routes
 * Centralizes Supabase client creation to avoid duplication
 */
import { createClient } from '@supabase/supabase-js';
import { validateEnvironment, isServerSide } from './envValidation.js';

// Run validation once on module load (server-side only)
let validationRun = false;

/**
 * Get Supabase client instance
 * @returns {SupabaseClient} Configured Supabase client
 */
export function getSupabaseClient() {
  // Run validation on first call (fail fast)
  if (!validationRun && isServerSide()) {
    const result = validateEnvironment();
    validationRun = true;

    if (!result.valid) {
      const errorMsg = 'Environment validation failed: ' + result.errors.join('; ');
      console.error('❌ ' + errorMsg);
      throw new Error(errorMsg);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.warn('⚠️ ' + w));
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}
