/*
  # Live spectating

  Adds an `allow_spectators` flag alongside the existing `is_shared` flag.
  `is_shared` means "the trial is over and the player chose to share the
  transcript" (set from VerdictDisplay). `allow_spectators` means "anyone
  can watch this trial, including while it's still in progress" — set at
  match-creation time instead.

  Defaults:
    - Quick Match (open board): spectatable by default — it's already
      visible to strangers on the open challenge board.
    - Invite a Friend / Pass & Play: private by default (column default
      false), opt-in via a checkbox at creation time.

  The existing public read policies from the shareable-transcripts
  migration are extended to also allow reads when allow_spectators=true,
  rather than replaced.
*/

ALTER TABLE case_sessions ADD COLUMN IF NOT EXISTS allow_spectators boolean NOT NULL DEFAULT false;
ALTER TABLE case_invitations ADD COLUMN IF NOT EXISTS allow_spectators boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "case_sessions_select_shared" ON case_sessions;
CREATE POLICY "case_sessions_select_shared"
  ON case_sessions FOR SELECT
  TO anon, authenticated
  USING (is_shared = true OR allow_spectators = true);

DROP POLICY IF EXISTS "trial_events_select_shared" ON trial_events;
CREATE POLICY "trial_events_select_shared"
  ON trial_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = trial_events.session_id
      AND (case_sessions.is_shared = true OR case_sessions.allow_spectators = true)
    )
  );

DROP POLICY IF EXISTS "verdicts_select_shared" ON verdicts;
CREATE POLICY "verdicts_select_shared"
  ON verdicts FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_sessions
      WHERE case_sessions.id = verdicts.session_id
      AND (case_sessions.is_shared = true OR case_sessions.allow_spectators = true)
    )
  );
