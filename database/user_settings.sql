-- =============================================================================
-- User Settings Table Migration
-- =============================================================================
-- Run this SQL in your AUTH Supabase project (Dashboard > SQL Editor)
-- This stores per-user settings including their own Supabase project credentials

-- Create the user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User's own Supabase project credentials (encrypted)
  supabase_url TEXT,
  supabase_key_encrypted TEXT,
  
  -- User preferences
  default_bucket TEXT DEFAULT 'files',
  max_retries INTEGER DEFAULT 3,
  theme TEXT DEFAULT 'dark',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Row Level Security Policies
-- =============================================================================

-- Policy: Users can read their own settings
CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own settings"
  ON user_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Service Role Access (for server-side operations)
-- =============================================================================
-- The service role key bypasses RLS, allowing the server to:
-- - Read/write settings for any user (after verifying JWT)
-- - This is necessary for the Settings API endpoint

-- =============================================================================
-- Auto-update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Verification Query
-- =============================================================================
-- Run this to verify the table was created correctly:
-- SELECT * FROM user_settings LIMIT 1;
-- 
-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'user_settings';
