/*
  # Private challenges (share a link) and "is my opponent here?" presence

  1. case_challenges
     - is_public: true = listed on the Challenge board for anyone; false = private, only reachable
       with its link (the challenge id is an unguessable uuid, so the link is the invitation: no email).
     - allow_spectators: carried to the game when someone joins (public matches have always allowed it).
  2. Security
     - Listing/reading a challenge row is limited to public open ones plus your own, so a private
       challenge never shows up in anyone's list.
     - Opening a private link goes through get_challenge_preview (read one challenge by id) and
       claim_challenge (take the open seat, atomically). Both need a signed-in player (guests count).
  3. session_presence + session_heartbeat
     - Each player's browser pings while the trial is open. The same call tells you whether the
       opponent pinged lately, so a game against a real person can pause while they are away.
     - The table has RLS on and no policies: it is only reachable through the function.
*/

ALTER TABLE public.case_challenges
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_spectators boolean NOT NULL DEFAULT true;

-- Only public open challenges are visible to everyone; your own are always visible to you.
DROP POLICY IF EXISTS "case_challenges_select" ON public.case_challenges;
CREATE POLICY "case_challenges_select"
  ON public.case_challenges FOR SELECT
  TO authenticated
  USING (
    (status = 'open' AND is_public)
    OR creator_user_id = auth.uid()
    OR opponent_user_id = auth.uid()
  );

-- Joining no longer updates the row directly (a private row is not readable by the joiner, and an
-- UPDATE needs to read it): it goes through claim_challenge below. Only the two players may update.
DROP POLICY IF EXISTS "case_challenges_update" ON public.case_challenges;
CREATE POLICY "case_challenges_update"
  ON public.case_challenges FOR UPDATE
  TO authenticated
  USING (creator_user_id = auth.uid() OR opponent_user_id = auth.uid())
  WITH CHECK (creator_user_id = auth.uid() OR opponent_user_id = auth.uid());

-- What the link page shows before you accept: the case, the creator's side and who is asking.
CREATE OR REPLACE FUNCTION public.get_challenge_preview(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.case_id, c.creator_user_id, c.creator_role, c.status, c.is_public,
         cs.title AS case_title, pp.username AS creator_name
    INTO v_row
    FROM case_challenges c
    LEFT JOIN cases cs ON cs.id = c.case_id
    LEFT JOIN public_profiles pp ON pp.user_id = c.creator_user_id
   WHERE c.id = p_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'case_id', v_row.case_id,
    'case_title', v_row.case_title,
    'creator_role', v_row.creator_role,
    'creator_name', v_row.creator_name,
    'status', v_row.status,
    'is_public', v_row.is_public,
    'is_mine', v_row.creator_user_id = auth.uid()
  );
END;
$$;

-- Takes the open seat in a challenge, once. Works for public and private challenges alike.
CREATE OR REPLACE FUNCTION public.claim_challenge(p_id uuid)
RETURNS public.case_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.case_challenges;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a challenge.';
  END IF;

  SELECT * INTO v_row FROM public.case_challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This challenge could not be found. The link may be wrong.';
  END IF;
  IF v_row.status <> 'open' THEN
    RAISE EXCEPTION 'This challenge is no longer open — someone may have already joined it.';
  END IF;
  IF v_row.creator_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t join your own challenge.';
  END IF;

  UPDATE public.case_challenges
     SET status = 'matched', opponent_user_id = auth.uid(), matched_at = now()
   WHERE id = p_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_challenge_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_challenge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_challenge_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_challenge(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Presence: is the other player here right now?
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.session_presence (
  session_id uuid NOT NULL REFERENCES public.case_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE public.session_presence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.session_heartbeat(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user uuid;
  v_other uuid;
  v_seen timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id, opposing_counsel_user_id INTO v_user, v_other
    FROM public.case_sessions
   WHERE id = p_session AND (user_id = v_uid OR opposing_counsel_user_id = v_uid);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- v_other becomes "the other player" (whoever of the two is not me).
  IF v_user = v_uid THEN
    NULL; -- v_other already is the opposing counsel
  ELSE
    v_other := v_user;
  END IF;

  INSERT INTO public.session_presence (session_id, user_id, last_seen)
  VALUES (p_session, v_uid, now())
  ON CONFLICT (session_id, user_id) DO UPDATE SET last_seen = now();

  IF v_other IS NULL THEN
    RETURN jsonb_build_object('opponent_online', false, 'opponent_last_seen', NULL);
  END IF;

  SELECT last_seen INTO v_seen FROM public.session_presence
   WHERE session_id = p_session AND user_id = v_other;

  RETURN jsonb_build_object(
    'opponent_online', COALESCE(v_seen > now() - interval '40 seconds', false),
    'opponent_last_seen', v_seen
  );
END;
$$;

REVOKE ALL ON FUNCTION public.session_heartbeat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.session_heartbeat(uuid) TO authenticated;
