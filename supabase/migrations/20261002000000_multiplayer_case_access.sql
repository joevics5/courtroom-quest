/*
  # Let match participants load the case

  Bug: a friend accepted an invitation to a 'basic'-tier preset case from a
  free account and got "Case not found". The cases SELECT policy hides
  tier-gated presets from lower tiers, and the friend's session row existed but
  the case did not load.

  Fix: a player who is part of a session (creator or opposing counsel) may read
  that session's case. case_sessions policies don't reference cases, so there is
  no recursion. evidence/witnesses policies already allow presets.
*/

DROP POLICY IF EXISTS "Match participants can view the case" ON cases;
CREATE POLICY "Match participants can view the case"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions s
      WHERE s.case_id = cases.id
        AND (s.user_id = auth.uid() OR s.opposing_counsel_user_id = auth.uid())
    )
  );
