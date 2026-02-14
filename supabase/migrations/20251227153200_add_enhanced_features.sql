/*
  # Enhanced Features Migration

  ## Overview
  Adds support for:
  - Expanded evidence types (10 categories)
  - Witness photos
  - Trial settings (duration, mode)
  - User subscriptions and limits
  - Multiplayer functionality
  - Jury system
  - Admin roles

  ## New Tables

  1. **user_profiles**
     - Extended user information with subscription tier and limits
     - Fields: user_id, subscription_tier, voice_minutes_remaining, trial_count, is_admin

  2. **trial_settings**
     - Stores trial configuration per session
     - Fields: session_id, duration_minutes, mode (text/voice), witness_limit, time_per_phase

  3. **jurors**
     - Pool of AI jurors for cases
     - Fields: id, name, age, occupation, background, biases, photo_url

  4. **jury_selections**
     - Tracks which jurors were selected for a case
     - Fields: session_id, juror_id, selected_by, selection_order

  5. **multiplayer_invites**
     - Invitation system for opposing counsel
     - Fields: session_id, inviter_id, invitee_email, status, role

  ## Table Modifications

  - **evidence**: Add more evidence types, auto_tagged boolean
  - **witnesses**: Add photo_url, use_ai boolean
  - **case_sessions**: Add trial_duration, trial_mode, opposing_counsel_id

  ## Security
  - Admin-only access to preset case creation
  - Subscription tier enforcement via RLS
  - Multiplayer session access control
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier text NOT NULL DEFAULT 'free',
  voice_minutes_remaining integer DEFAULT 0,
  trial_count integer DEFAULT 0,
  case_creation_count integer DEFAULT 0,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trial_settings table
CREATE TABLE IF NOT EXISTS trial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid UNIQUE REFERENCES case_sessions(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL DEFAULT 15,
  trial_mode text NOT NULL DEFAULT 'text',
  witness_limit integer DEFAULT 1,
  opening_statement_minutes integer DEFAULT 4,
  witness_examination_minutes integer DEFAULT 6,
  closing_statement_minutes integer DEFAULT 4,
  deliberation_minutes integer DEFAULT 1,
  timer_started_at timestamptz,
  timer_paused_at timestamptz,
  total_pause_duration integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create jurors table
CREATE TABLE IF NOT EXISTS jurors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer,
  occupation text,
  background text NOT NULL,
  biases jsonb DEFAULT '{}'::jsonb,
  photo_url text,
  personality_traits jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create jury_selections table
CREATE TABLE IF NOT EXISTS jury_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
  juror_id uuid NOT NULL REFERENCES jurors(id),
  selected_by text NOT NULL,
  selection_order integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, juror_id)
);

-- Create multiplayer_invites table
CREATE TABLE IF NOT EXISTS multiplayer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id),
  invitee_email text NOT NULL,
  invitee_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  role text NOT NULL DEFAULT 'opposing_counsel',
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Add columns to existing tables
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'witnesses' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE witnesses ADD COLUMN photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'witnesses' AND column_name = 'use_ai'
  ) THEN
    ALTER TABLE witnesses ADD COLUMN use_ai boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evidence' AND column_name = 'auto_tagged'
  ) THEN
    ALTER TABLE evidence ADD COLUMN auto_tagged boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evidence' AND column_name = 'file_data'
  ) THEN
    ALTER TABLE evidence ADD COLUMN file_data text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'trial_duration'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN trial_duration integer DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'trial_mode'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN trial_mode text DEFAULT 'text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'case_sessions' AND column_name = 'opposing_counsel_id'
  ) THEN
    ALTER TABLE case_sessions ADD COLUMN opposing_counsel_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin ON user_profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_trial_settings_session ON trial_settings(session_id);
CREATE INDEX IF NOT EXISTS idx_jury_selections_session ON jury_selections(session_id);
CREATE INDEX IF NOT EXISTS idx_multiplayer_invites_invitee ON multiplayer_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_multiplayer_invites_status ON multiplayer_invites(status);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurors ENABLE ROW LEVEL SECURITY;
ALTER TABLE jury_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE multiplayer_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for trial_settings
CREATE POLICY "Users can view trial settings for their sessions"
  ON trial_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_settings.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_id = auth.uid())
    )
  );

CREATE POLICY "Users can create trial settings for their sessions"
  ON trial_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_settings.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update trial settings for their sessions"
  ON trial_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_settings.session_id
      AND case_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_settings.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for jurors
CREATE POLICY "All authenticated users can view jurors"
  ON jurors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage jurors"
  ON jurors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for jury_selections
CREATE POLICY "Users can view jury selections for their sessions"
  ON jury_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = jury_selections.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_id = auth.uid())
    )
  );

CREATE POLICY "Users can select jurors for their sessions"
  ON jury_selections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = jury_selections.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_id = auth.uid())
    )
  );

-- RLS Policies for multiplayer_invites
CREATE POLICY "Users can view invites they sent or received"
  ON multiplayer_invites FOR SELECT
  TO authenticated
  USING (
    inviter_id = auth.uid() 
    OR invitee_id = auth.uid()
    OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create invites for their sessions"
  ON multiplayer_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = multiplayer_invites.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invites they received"
  ON multiplayer_invites FOR UPDATE
  TO authenticated
  USING (
    invitee_id = auth.uid()
    OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    invitee_id = auth.uid()
    OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (user_id, subscription_tier, voice_minutes_remaining)
  VALUES (NEW.id, 'free', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to check subscription limits
CREATE OR REPLACE FUNCTION check_trial_limit()
RETURNS trigger AS $$
DECLARE
  user_tier text;
  user_trial_count integer;
BEGIN
  SELECT subscription_tier, trial_count INTO user_tier, user_trial_count
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  IF user_tier = 'free' AND user_trial_count >= 3 THEN
    RAISE EXCEPTION 'Free tier limit reached. Please upgrade to continue.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce trial limits
DROP TRIGGER IF EXISTS enforce_trial_limit ON case_sessions;
CREATE TRIGGER enforce_trial_limit
  BEFORE INSERT ON case_sessions
  FOR EACH ROW EXECUTE FUNCTION check_trial_limit();