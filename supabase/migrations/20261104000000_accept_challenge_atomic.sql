/*
  # Accept a challenge once, atomically; link page knows who is in the game

  1. accept_challenge(p_id)
     Takes the open seat AND creates the shared game AND links it, in one transaction, so a failure
     can never leave a challenge "matched" with no game. Safe to call again: the person who already
     accepted gets their game back; anyone else is told it was already accepted.
  2. get_challenge_preview
     Also says whether you are the one who accepted, the opponent's name, and (to the two players
     only) the game's id, so the link page can show "Accepted" and open the case.
*/

CREATE OR REPLACE FUNCTION public.get_challenge_preview(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_me uuid := auth.uid();
  v_player boolean;
BEGIN
  IF v_me IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.case_id, c.creator_user_id, c.opponent_user_id, c.creator_role, c.status, c.is_public,
         c.session_id, cs.title AS case_title, pp.username AS creator_name, po.username AS opponent_name
    INTO v_row
    FROM case_challenges c
    LEFT JOIN cases cs ON cs.id = c.case_id
    LEFT JOIN public_profiles pp ON pp.user_id = c.creator_user_id
    LEFT JOIN public_profiles po ON po.user_id = c.opponent_user_id
   WHERE c.id = p_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_player := v_row.creator_user_id = v_me OR COALESCE(v_row.opponent_user_id = v_me, false);

  RETURN jsonb_build_object(
    'id', v_row.id,
    'case_id', v_row.case_id,
    'case_title', v_row.case_title,
    'creator_role', v_row.creator_role,
    'creator_name', v_row.creator_name,
    'opponent_name', CASE WHEN v_player THEN v_row.opponent_name ELSE NULL END,
    'status', v_row.status,
    'is_public', v_row.is_public,
    'is_mine', v_row.creator_user_id = v_me,
    'is_opponent', COALESCE(v_row.opponent_user_id = v_me, false),
    'session_id', CASE WHEN v_player THEN v_row.session_id ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_challenge(p_id uuid)
RETURNS public.case_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.case_challenges;
  v_session public.case_sessions;
  v_pros uuid;
  v_def uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a challenge.';
  END IF;

  SELECT * INTO v_row FROM public.case_challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This challenge could not be found. The link may be wrong.';
  END IF;
  IF v_row.creator_user_id = v_me THEN
    RAISE EXCEPTION 'You can''t join your own challenge.';
  END IF;
  IF v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'This challenge was cancelled.';
  END IF;

  IF v_row.status = 'matched' THEN
    IF v_row.opponent_user_id IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'This challenge was already accepted by someone else.';
    END IF;
    -- Same person again (double tap, reload, old link): hand their game back.
    IF v_row.session_id IS NOT NULL THEN
      SELECT * INTO v_session FROM public.case_sessions WHERE id = v_row.session_id;
      IF FOUND THEN
        RETURN v_session;
      END IF;
    END IF;
    -- Accepted but the game was never created (an earlier failure): finish the job, recent ones only.
    IF v_row.matched_at IS NULL OR v_row.matched_at < now() - interval '1 day' THEN
      RAISE EXCEPTION 'This challenge was already accepted.';
    END IF;
  ELSE
    UPDATE public.case_challenges
       SET status = 'matched', opponent_user_id = v_me, matched_at = now()
     WHERE id = p_id;
  END IF;

  IF v_row.creator_role = 'prosecution' THEN
    v_pros := v_row.creator_user_id; v_def := v_me;
  ELSE
    v_def := v_row.creator_user_id; v_pros := v_me;
  END IF;

  INSERT INTO public.case_sessions (
    case_id, user_id, opposing_counsel_user_id, current_phase, evidence_filed, witnesses_locked,
    allow_spectators, session_state
  ) VALUES (
    v_row.case_id, v_row.creator_user_id, v_me, 'investigation', false, false,
    COALESCE(v_row.allow_spectators, true),
    jsonb_build_object('isMultiplayer', true, 'prosecutionUserId', v_pros, 'defenseUserId', v_def)
  ) RETURNING * INTO v_session;

  UPDATE public.case_challenges SET session_id = v_session.id WHERE id = p_id;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_challenge(uuid) TO authenticated;
