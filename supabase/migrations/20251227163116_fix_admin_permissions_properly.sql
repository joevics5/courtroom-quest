/*
  # Fix Admin Permissions Properly

  ## Overview
  Fixes admin policies to work without recursion while maintaining security

  ## Changes Made
  1. Drops overly permissive policies
  2. Keeps preset cases read-only for regular users
  3. Admin checks will happen at application level

  ## Security
  - Regular users can only read preset cases
  - Regular users can fully manage their own custom cases
  - Admin functionality controlled by application layer
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow preset case management" ON cases;
DROP POLICY IF EXISTS "Allow evidence for preset cases" ON evidence;
DROP POLICY IF EXISTS "Allow witnesses for preset cases" ON witnesses;

-- Preset cases are READ ONLY for all authenticated users
-- Admins will need to use service role key for modifications
-- This prevents recursion and is more secure

-- Note: The existing policies already handle this correctly:
-- "Preset cases are viewable by all authenticated users" - SELECT only
-- "Users can create custom cases" - custom cases only
-- "Users can update their own custom cases" - custom cases only
-- "Users can delete their own custom cases" - custom cases only
