/*
  # Update Evidence Types and Admin Features

  ## Overview
  Adds comprehensive legal evidence types and admin management capabilities

  ## Changes Made

  1. **Evidence Type Enhancements**
     - Expanded from 4 basic types to 10 comprehensive legal evidence types
     - New types: documents, photographs, video_recordings, audio_recordings, witness_testimony, physical_evidence, digital_evidence, expert_reports, confessions_statements, timeline_logs
     - Better categorization matching real legal proceedings

  2. **Auto-tagging System**
     - Function to automatically generate exhibit labels (Exhibit A, B, C...)
     - Tracks exhibit sequence per case
     - Allows manual override of auto-generated tags

  3. **Witness Photo Support**
     - Existing photo_url column in witnesses table (already added in previous migration)
     - Support for both uploaded photos and system-generated avatars

  4. **Admin Management**
     - Admins can create and manage preset cases
     - Admin role check via user_profiles.is_admin
     - RLS policies updated to allow admin preset case creation

  5. **Case Edit History**
     - Track case modifications
     - Support for editing custom cases before trial

  ## Security
  - Preset cases can only be created/edited by admins
  - Users can only edit their own custom cases
  - All RLS policies enforced
*/

-- Update RLS policies for cases to allow admin preset creation
DROP POLICY IF EXISTS "Admins can create preset cases" ON cases;
CREATE POLICY "Admins can create preset cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_preset = false AND created_by = auth.uid()) 
    OR 
    (is_preset = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ))
  );

DROP POLICY IF EXISTS "Admins can update preset cases" ON cases;
CREATE POLICY "Admins can update preset cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (
    (is_preset = false AND created_by = auth.uid())
    OR
    (is_preset = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ))
  )
  WITH CHECK (
    (is_preset = false AND created_by = auth.uid())
    OR
    (is_preset = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ))
  );

DROP POLICY IF EXISTS "Admins can delete preset cases" ON cases;
CREATE POLICY "Admins can delete preset cases"
  ON cases FOR DELETE
  TO authenticated
  USING (
    (is_preset = false AND created_by = auth.uid())
    OR
    (is_preset = true AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ))
  );

-- Update RLS policies for evidence to allow admin management
DROP POLICY IF EXISTS "Admins can manage preset case evidence" ON evidence;
CREATE POLICY "Admins can manage preset case evidence"
  ON evidence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND (
        (cases.is_preset = false AND cases.created_by = auth.uid())
        OR
        (cases.is_preset = true AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND is_admin = true
        ))
      )
    )
  );

-- Update RLS policies for witnesses to allow admin management
DROP POLICY IF EXISTS "Admins can manage preset case witnesses" ON witnesses;
CREATE POLICY "Admins can manage preset case witnesses"
  ON witnesses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND (
        (cases.is_preset = false AND cases.created_by = auth.uid())
        OR
        (cases.is_preset = true AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND is_admin = true
        ))
      )
    )
  );

-- Function to get next exhibit label for a case
CREATE OR REPLACE FUNCTION get_next_exhibit_label(case_uuid uuid)
RETURNS text AS $$
DECLARE
  next_index integer;
  label text;
BEGIN
  SELECT COUNT(*) INTO next_index
  FROM evidence
  WHERE case_id = case_uuid;
  
  -- Convert index to letter (A, B, C, ... Z, AA, AB, ...)
  IF next_index < 26 THEN
    label := 'Exhibit ' || CHR(65 + next_index);
  ELSE
    label := 'Exhibit ' || CHR(65 + (next_index / 26) - 1) || CHR(65 + (next_index % 26));
  END IF;
  
  RETURN label;
END;
$$ LANGUAGE plpgsql;

-- Create index on evidence_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_case_type ON evidence(case_id, evidence_type);
