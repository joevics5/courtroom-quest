/*
  # Live two-player setup (investigation -> setup -> jury -> pre-trial)

  1. merge_session_state(p_session, p_patch, p_phase, p_trial_phase)
     Either player of a game can merge a few keys into case_sessions.session_state (and optionally move
     the game to the next phase) in ONE atomic statement. The old way (read the JSON, change it, write it
     all back) let two players overwrite each other's changes, e.g. "I'm seated" vs "I'm ready".
     The keys that decide who is who (isMultiplayer, sameDevicePlay, prosecutionUserId, defenseUserId)
     cannot be changed through it.

  2. Entering 'pre-trial' wipes the pre-trial progress keys (seats, started, step, plea), so a case sent
     back to the start of the pre-trial after a granted appeal begins from scratch for both players.
*/

CREATE OR REPLACE FUNCTION public.merge_session_state(
  p_session uuid,
  p_patch jsonb,
  p_phase text DEFAULT NULL,
  p_trial_phase integer DEFAULT NULL
)
RETURNS public.case_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.case_sessions;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to play.';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'The update must be a JSON object.';
  END IF;

  IF p_patch ?| ARRAY['isMultiplayer', 'sameDevicePlay', 'prosecutionUserId', 'defenseUserId', 'creatorRole'] THEN
    RAISE EXCEPTION 'Who is playing which side cannot be changed.';
  END IF;

  SELECT * INTO v_row FROM public.case_sessions WHERE id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That game could not be found.';
  END IF;
  IF v_row.user_id IS DISTINCT FROM v_me AND v_row.opposing_counsel_user_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'You are not a player in this game.';
  END IF;

  UPDATE public.case_sessions
     SET session_state = COALESCE(session_state, '{}'::jsonb) || p_patch,
         current_phase = COALESCE(p_phase, current_phase),
         current_trial_phase = COALESCE(p_trial_phase, current_trial_phase)
   WHERE id = p_session
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_session_state(uuid, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_session_state(uuid, jsonb, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_pretrial_state_on_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.session_state := COALESCE(NEW.session_state, '{}'::jsonb)
    - ARRAY['seatedProsecution', 'seatedDefense', 'pretrialStarted', 'pretrialStep', 'pretrialPlea'];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_pretrial_state_on_entry ON public.case_sessions;
CREATE TRIGGER trg_reset_pretrial_state_on_entry
  BEFORE UPDATE OF current_phase ON public.case_sessions
  FOR EACH ROW
  WHEN (NEW.current_phase = 'pre-trial' AND OLD.current_phase IS DISTINCT FROM 'pre-trial')
  EXECUTE FUNCTION public.reset_pretrial_state_on_entry();
