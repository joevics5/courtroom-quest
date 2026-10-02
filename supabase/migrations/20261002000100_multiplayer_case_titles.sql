/*
  # Show case titles on invitations and the open challenge board

  Invitations and open challenges embed `cases(title)`. For a case above the
  viewer's subscription tier the cases SELECT policy hid the row, so the title
  came back empty and the UI showed a bare "Case". Let invitees see the case
  they were invited to, and let signed-in players see cases that have an open
  challenge. (case_invitations / case_challenges policies don't reference
  cases, so there is no recursion.)
*/

DROP POLICY IF EXISTS "Invitees can view the invited case" ON cases;
CREATE POLICY "Invitees can view the invited case"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_invitations i
      WHERE i.case_id = cases.id
        AND i.status = 'pending'
        AND (
          i.invitee_user_id = auth.uid()
          OR lower(i.invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

DROP POLICY IF EXISTS "Open challenge cases are viewable" ON cases;
CREATE POLICY "Open challenge cases are viewable"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_challenges c
      WHERE c.case_id = cases.id AND c.status = 'open'
    )
  );
