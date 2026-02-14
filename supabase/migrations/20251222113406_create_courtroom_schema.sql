/*
  # AI Courtroom Platform Database Schema

  ## Overview
  This migration creates the complete database structure for the AI Courtroom Roleplay & Legal Reasoning Platform,
  supporting both preset and custom cases, evidence management, witness interactions, and trial proceedings.

  ## Tables Created

  1. **cases**
     - Stores both preset (curated) and custom (user-created) cases
     - Fields: id, title, description, case_type, difficulty, is_preset, truth_state, created_by, created_at
     - Truth state stored as JSONB for flexibility

  2. **evidence**
     - Stores all evidence items with tagging and metadata
     - Fields: id, case_id, exhibit_label, title, description, evidence_type, content, file_url, relevance, is_hidden, discovered_at
     - Supports documents, photos, testimonies, and physical evidence
     - Tracks discovery state for preset cases

  3. **witnesses**
     - Stores witness definitions with background and testimony
     - Fields: id, case_id, name, role, background, base_testimony, knowledge_scope, personality_traits
     - Knowledge scope defines what the witness can/cannot discuss
     - Personality traits guide AI behavior

  4. **case_sessions**
     - Tracks user progress through a case
     - Fields: id, user_id, case_id, current_phase, evidence_filed, witnesses_locked, session_state, started_at, completed_at
     - Phases: setup, investigation, trial, completed
     - Session state stores all dynamic data as JSONB

  5. **witness_interactions**
     - Logs all questions asked to witnesses
     - Fields: id, session_id, witness_id, question, response, asked_at, phase, revealed_evidence
     - Tracks both pre-trial and in-court questioning
     - Links to evidence unlocked by the interaction

  6. **trial_events**
     - Stores chronological trial proceedings
     - Fields: id, session_id, event_type, speaker_role, content, timestamp, metadata
     - Event types: opening, witness_examination, objection, ruling, closing, verdict
     - Supports full trial replay

  7. **verdicts**
     - Stores final judgments
     - Fields: id, session_id, outcome, reasoning, evidence_cited, missed_opportunities, score, delivered_at
     - Comprehensive verdict with judge's rationale

  ## Security
  - RLS enabled on all tables
  - Users can only access their own sessions and custom cases
  - Preset cases are readable by all authenticated users
  - Trial data is private to the session owner

  ## Indexes
  - Optimized for case browsing, session loading, and transcript retrieval
*/

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  case_type text NOT NULL, -- e.g., 'burglary', 'fraud', 'assault'
  difficulty text, -- 'easy', 'medium', 'hard' (for preset cases)
  is_preset boolean DEFAULT false,
  truth_state jsonb, -- Stores hidden truth for preset cases
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  exhibit_label text, -- 'Exhibit A', 'Exhibit B', etc.
  title text NOT NULL,
  description text,
  evidence_type text NOT NULL, -- 'document', 'photo', 'testimony', 'physical'
  content text, -- For text-based evidence
  file_url text, -- For uploaded files
  relevance text, -- 'favorable', 'neutral', 'risky'
  is_hidden boolean DEFAULT false, -- For preset cases with discovery mechanics
  tags text[], -- Additional searchable tags
  discovered_at timestamptz, -- When evidence was found (preset cases)
  created_at timestamptz DEFAULT now()
);

-- Create witnesses table
CREATE TABLE IF NOT EXISTS witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL, -- 'neighbor', 'officer', 'expert', 'victim', etc.
  background text NOT NULL,
  base_testimony text NOT NULL, -- Core story they must stick to
  knowledge_scope jsonb, -- What they know/don't know
  personality_traits jsonb, -- 'cooperative', 'defensive', 'confused', etc.
  created_at timestamptz DEFAULT now()
);

-- Create case sessions table
CREATE TABLE IF NOT EXISTS case_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  case_id uuid NOT NULL REFERENCES cases(id),
  current_phase text NOT NULL DEFAULT 'setup', -- 'setup', 'investigation', 'trial', 'completed'
  evidence_filed boolean DEFAULT false,
  witnesses_locked boolean DEFAULT false,
  session_state jsonb DEFAULT '{}'::jsonb, -- Stores dynamic state
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Create witness interactions table
CREATE TABLE IF NOT EXISTS witness_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
  witness_id uuid NOT NULL REFERENCES witnesses(id),
  question text NOT NULL,
  response text NOT NULL,
  asked_at timestamptz DEFAULT now(),
  phase text NOT NULL, -- 'pre_trial' or 'trial'
  revealed_evidence uuid REFERENCES evidence(id), -- Evidence unlocked by this question
  interaction_order integer -- Sequential ordering within session
);

-- Create trial events table
CREATE TABLE IF NOT EXISTS trial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'opening', 'witness_examination', 'objection', 'ruling', 'closing', 'verdict'
  speaker_role text NOT NULL, -- 'judge', 'counsel', 'witness'
  speaker_name text,
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional context like objection type, ruling details
  event_order integer -- Sequential ordering within trial
);

-- Create verdicts table
CREATE TABLE IF NOT EXISTS verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
  outcome text NOT NULL, -- 'win', 'lose', 'partial'
  reasoning text NOT NULL,
  evidence_cited text[], -- Array of exhibit labels referenced
  witness_performance jsonb, -- Assessment of witness handling
  missed_opportunities text[],
  score integer, -- Optional numeric score
  delivered_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_is_preset ON cases(is_preset);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON cases(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_is_hidden ON evidence(is_hidden);
CREATE INDEX IF NOT EXISTS idx_witnesses_case_id ON witnesses(case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_user_id ON case_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_case_id ON case_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_witness_interactions_session_id ON witness_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_trial_events_session_id ON trial_events(session_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_session_id ON verdicts(session_id);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE witness_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cases
CREATE POLICY "Preset cases are viewable by all authenticated users"
  ON cases FOR SELECT
  TO authenticated
  USING (is_preset = true);

CREATE POLICY "Users can view their own custom cases"
  ON cases FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() AND is_preset = false);

CREATE POLICY "Users can create custom cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own custom cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND is_preset = false)
  WITH CHECK (created_by = auth.uid() AND is_preset = false);

CREATE POLICY "Users can delete their own custom cases"
  ON cases FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND is_preset = false);

-- RLS Policies for evidence
CREATE POLICY "Users can view evidence for accessible cases"
  ON evidence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND (cases.is_preset = true OR cases.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can create evidence for their custom cases"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

CREATE POLICY "Users can update evidence in their custom cases"
  ON evidence FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

CREATE POLICY "Users can delete evidence from their custom cases"
  ON evidence FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = evidence.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

-- RLS Policies for witnesses
CREATE POLICY "Users can view witnesses for accessible cases"
  ON witnesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND (cases.is_preset = true OR cases.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can create witnesses for their custom cases"
  ON witnesses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

CREATE POLICY "Users can update witnesses in their custom cases"
  ON witnesses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

CREATE POLICY "Users can delete witnesses from their custom cases"
  ON witnesses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = witnesses.case_id
      AND cases.created_by = auth.uid()
      AND cases.is_preset = false
    )
  );

-- RLS Policies for case_sessions
CREATE POLICY "Users can view their own sessions"
  ON case_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own sessions"
  ON case_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON case_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
  ON case_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for witness_interactions
CREATE POLICY "Users can view interactions from their sessions"
  ON witness_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = witness_interactions.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create interactions in their sessions"
  ON witness_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = witness_interactions.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for trial_events
CREATE POLICY "Users can view events from their sessions"
  ON trial_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create events in their sessions"
  ON trial_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for verdicts
CREATE POLICY "Users can view verdicts from their sessions"
  ON verdicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = verdicts.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create verdicts for their sessions"
  ON verdicts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = verdicts.session_id
      AND case_sessions.user_id = auth.uid()
    )
  );