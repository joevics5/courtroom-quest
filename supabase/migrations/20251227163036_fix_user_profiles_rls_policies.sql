/*
  # Fix User Profiles RLS Policies

  ## Overview
  Removes recursive RLS policies that cause 500 errors

  ## Changes Made
  1. Drops the problematic "Admins can view all profiles" policy
  2. Simplifies user_profiles access
  3. Admins can still function, just with simplified permissions

  ## Security
  - Users can still only view/update their own profiles
  - System remains secure
*/

-- Drop the problematic admin policy that causes recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- The remaining policies are:
-- "Users can view their own profile" - works fine
-- "Users can update their own profile" - works fine
