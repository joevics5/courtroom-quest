/*
  # Fix multiplayer session creation + finish friend invitations

  1. Bug fix
    - `case_sessions` INSERT policy only allowed `user_id = auth.uid()`.
      Both `challenges.joinChallenge` and the new `invitations.acceptInvitation`
      insert the session as the *second* player (the one accepting), with
      `user_id` set to the original creator/inviter and
      `opposing_counsel_user_id` set to themselves. That insert was being
      silently rejected by RLS, so accepting a challenge or invite never
      actually worked.

  2. Finish case_invitations
    - Add `inviter_role` so the invitee is automatically assigned the
      opposite side.
    - Broaden SELECT/UPDATE so an invited player can see and accept an
      invite sent to their email before `invitee_user_id` is filled in.
*/

-- 1. Allow the second player to create the shared session.
DROP POLICY IF EXISTS "sessions_insert" ON case_sessions;
CREATE POLICY "sessions_insert"
  ON case_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR opposing_counsel_user_id = auth.uid());

-- 2. case_invitations: role column
ALTER TABLE case_invitations ADD COLUMN IF NOT EXISTS inviter_role text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_invitations_inviter_role_check'
  ) THEN
    ALTER TABLE case_invitations ADD CONSTRAINT case_invitations_inviter_role_check
      CHECK (inviter_role IN ('defense', 'prosecution'));
  END IF;
END $$;

-- Let an invitee find/see/accept invites addressed to their email even
-- before invitee_user_id has been filled in (it's only set once they
-- actually accept).
DROP POLICY IF EXISTS "invitations_select" ON case_invitations;
CREATE POLICY "invitations_select"
  ON case_invitations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = inviter_user_id
    OR auth.uid() = invitee_user_id
    OR lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "invitations_update" ON case_invitations;
CREATE POLICY "invitations_update"
  ON case_invitations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = invitee_user_id
    OR (invitee_user_id IS NULL AND lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (
    auth.uid() = invitee_user_id
    OR auth.uid() = inviter_user_id
  );
