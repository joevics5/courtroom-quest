/*
  # Complete Feature Additions

  1. Updates
    - Fix user_profiles RLS
    - Add multiplayer columns
    - Add jury system tables
    - Add subscription tiers
    - Insert preset cases and jurors

  2. Security
    - Simple, non-recursive RLS policies
*/

-- Update user_profiles table first
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS voice_minutes_remaining integer DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trial_count integer DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS case_creation_count integer DEFAULT 0;

-- Update cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_multiplayer boolean DEFAULT false;

-- Update case_sessions table
ALTER TABLE case_sessions ADD COLUMN IF NOT EXISTS opposing_counsel_user_id uuid;
ALTER TABLE case_sessions ADD COLUMN IF NOT EXISTS trial_type text DEFAULT 'judge';
ALTER TABLE case_sessions ADD COLUMN IF NOT EXISTS jury_selection_complete boolean DEFAULT false;

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'case_sessions_trial_type_check'
  ) THEN
    ALTER TABLE case_sessions ADD CONSTRAINT case_sessions_trial_type_check 
    CHECK (trial_type IN ('judge', 'jury'));
  END IF;
END $$;

-- Create jurors table
CREATE TABLE IF NOT EXISTS jurors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer NOT NULL,
  occupation text NOT NULL,
  background text NOT NULL,
  personality_traits text[] DEFAULT '{}',
  biases text[] DEFAULT '{}',
  education_level text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jurors ENABLE ROW LEVEL SECURITY;

-- Create case_invitations table
CREATE TABLE IF NOT EXISTS case_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  session_id uuid REFERENCES case_sessions(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL,
  invitee_email text NOT NULL,
  invitee_user_id uuid,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))
);

ALTER TABLE case_invitations ENABLE ROW LEVEL SECURITY;

-- Create jury_selections table
CREATE TABLE IF NOT EXISTS jury_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES case_sessions(id) ON DELETE CASCADE,
  juror_id uuid REFERENCES jurors(id) ON DELETE CASCADE,
  selected_by text NOT NULL,
  selection_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (selected_by IN ('prosecution', 'defense')),
  UNIQUE(session_id, juror_id)
);

ALTER TABLE jury_selections ENABLE ROW LEVEL SECURITY;

-- Now fix all RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON user_profiles;

CREATE POLICY "user_profiles_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_update"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_insert"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Jurors policies
DROP POLICY IF EXISTS "Anyone authenticated can view jurors" ON jurors;
CREATE POLICY "jurors_select"
  ON jurors FOR SELECT
  TO authenticated
  USING (true);

-- Case invitations policies
DROP POLICY IF EXISTS "Users can view invitations they sent or received" ON case_invitations;
DROP POLICY IF EXISTS "Users can create invitations for their own cases" ON case_invitations;
DROP POLICY IF EXISTS "Users can update invitations they received" ON case_invitations;

CREATE POLICY "invitations_select"
  ON case_invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id);

CREATE POLICY "invitations_insert"
  ON case_invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_user_id);

CREATE POLICY "invitations_update"
  ON case_invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_user_id);

-- Jury selections policies
DROP POLICY IF EXISTS "Users can view jury selections for their sessions" ON jury_selections;
DROP POLICY IF EXISTS "Users can create jury selections for their sessions" ON jury_selections;
DROP POLICY IF EXISTS "Users can delete jury selections" ON jury_selections;

CREATE POLICY "jury_selections_select"
  ON jury_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

CREATE POLICY "jury_selections_insert"
  ON jury_selections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

CREATE POLICY "jury_selections_delete"
  ON jury_selections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

-- Update case_sessions policies
DROP POLICY IF EXISTS "Users can read own sessions" ON case_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON case_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON case_sessions;

CREATE POLICY "sessions_select"
  ON case_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR opposing_counsel_user_id = auth.uid());

CREATE POLICY "sessions_update"
  ON case_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR opposing_counsel_user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR opposing_counsel_user_id = auth.uid());

CREATE POLICY "sessions_insert"
  ON case_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
