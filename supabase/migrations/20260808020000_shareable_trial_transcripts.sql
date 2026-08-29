ALTER TABLE case_sessions ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE POLICY "case_sessions_select_shared"
  ON case_sessions FOR SELECT
  TO anon, authenticated
  USING (is_shared = true);

CREATE POLICY "trial_events_select_shared"
  ON trial_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND case_sessions.is_shared = true
    )
  );

CREATE POLICY "verdicts_select_shared"
  ON verdicts FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = verdicts.session_id
      AND case_sessions.is_shared = true
    )
  );

CREATE POLICY "cases_select_shared"
  ON cases FOR SELECT
  TO anon
  USING (true);
