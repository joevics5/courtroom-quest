-- Fix trial_events / witness_interactions RLS to match case_sessions:
-- opposing_counsel_user_id already exists on case_sessions and its own
-- RLS already allows the second player, but these two tables were never
-- updated to match, which would silently block the second player from
-- reading or writing either one.

DROP POLICY IF EXISTS "Users can view events from their sessions" ON trial_events;
DROP POLICY IF EXISTS "Users can create events in their sessions" ON trial_events;

CREATE POLICY "trial_events_select"
  ON trial_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

CREATE POLICY "trial_events_insert"
  ON trial_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view interactions from their sessions" ON witness_interactions;
DROP POLICY IF EXISTS "Users can create interactions in their sessions" ON witness_interactions;

CREATE POLICY "witness_interactions_select"
  ON witness_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = witness_interactions.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

CREATE POLICY "witness_interactions_insert"
  ON witness_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = witness_interactions.session_id
      AND (case_sessions.user_id = auth.uid() OR case_sessions.opposing_counsel_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Challenge board: a simple "open lobby" for 1v1 human trials.
-- A player picks a case and a side, opens a challenge; another player
-- browses open challenges and joins one, taking the opposite side.
-- Kept intentionally simple (no matchmaking algorithm, no ranking) —
-- this is a V1 to learn from real usage, not a finished system.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS case_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id),
  creator_role text NOT NULL CHECK (creator_role IN ('defense', 'prosecution')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'cancelled')),
  opponent_user_id uuid REFERENCES auth.users(id),
  session_id uuid REFERENCES case_sessions(id),
  created_at timestamptz DEFAULT now(),
  matched_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_case_challenges_status ON case_challenges(status);
CREATE INDEX IF NOT EXISTS idx_case_challenges_creator ON case_challenges(creator_user_id);

ALTER TABLE case_challenges ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see open challenges (that's the point of a lobby),
-- plus their own challenges regardless of status.
CREATE POLICY "case_challenges_select"
  ON case_challenges FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    OR creator_user_id = auth.uid()
    OR opponent_user_id = auth.uid()
  );

CREATE POLICY "case_challenges_insert"
  ON case_challenges FOR INSERT
  TO authenticated
  WITH CHECK (creator_user_id = auth.uid());

-- The creator can cancel their own open challenge; anyone can join an
-- open challenge (which is what actually assigns opponent_user_id) —
-- the WITH CHECK still requires the row to make sense after the update.
CREATE POLICY "case_challenges_update"
  ON case_challenges FOR UPDATE
  TO authenticated
  USING (status = 'open' OR creator_user_id = auth.uid() OR opponent_user_id = auth.uid())
  WITH CHECK (creator_user_id = auth.uid() OR opponent_user_id = auth.uid());
