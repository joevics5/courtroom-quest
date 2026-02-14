/*
  # Fix Cases RLS for Custom Cases

  1. Changes
    - Add back the RLS policy for users to view their own custom cases
    - This was accidentally not included when updating the preset cases policy

  2. Security
    - Users can view their own custom cases (non-preset)
    - Preset cases are filtered by subscription tier
*/

-- Add policy for users to view their own custom cases
CREATE POLICY "Users can view own custom cases"
  ON cases FOR SELECT
  TO authenticated
  USING (is_preset = false AND created_by = auth.uid());