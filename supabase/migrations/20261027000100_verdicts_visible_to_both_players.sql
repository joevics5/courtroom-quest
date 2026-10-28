/*
  # Both players in a game can read its verdict

  Until now only the session owner could read a verdict row. In an online game the second player
  (opposing_counsel_user_id) could not, which also meant they could not open an appeal filed
  against them or see the game in their case history. This adds read access for that player only,
  for their own game. Nothing else changes (no new write access).
*/
DROP POLICY IF EXISTS "verdicts_select_participants" ON verdicts;
CREATE POLICY "verdicts_select_participants"
  ON verdicts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions s
      WHERE s.id = verdicts.session_id
        AND s.opposing_counsel_user_id = auth.uid()
    )
  );
