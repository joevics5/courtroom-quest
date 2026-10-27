/*
  # Reopening a case after a granted appeal

  The appeal flow itself lives in case_sessions.session_state.appeals. This function does the one step the browser
  cannot do on its own: put the case back to the start of the pre-trial.

  - The old verdict (and the jury's ballots) are archived in session_state.appealHistory, then the verdict row is removed
    so the reopened trial can deliver a fresh one (the app expects one verdict per session).
  - Win credit for the old verdict is taken back (case_winners row removed, wins and rank recomputed). The new verdict's
    trigger credits whoever wins the reopened trial, once.
  - The trial clocks are reset. The transcript (trial_events), jurors, judge, cast, format and time limit are kept.
  - Only the two players in the case can call it, and only for an appeal the judge granted that was not reopened yet.
*/

CREATE OR REPLACE FUNCTION public.reopen_case_for_appeal(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s case_sessions%ROWTYPE;
  v verdicts%ROWTYPE;
  st jsonb;
  appeals jsonb;
  n integer;
  last_appeal jsonb;
  history jsonb;
  w record;
  total integer;
BEGIN
  SELECT * INTO s FROM case_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> s.user_id AND auth.uid() IS DISTINCT FROM s.opposing_counsel_user_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  st := COALESCE(s.session_state, '{}'::jsonb);
  appeals := COALESCE(st->'appeals', '[]'::jsonb);
  IF jsonb_typeof(appeals) <> 'array' OR jsonb_array_length(appeals) = 0 THEN
    RAISE EXCEPTION 'No appeal to reopen';
  END IF;
  n := jsonb_array_length(appeals);
  last_appeal := appeals -> (n - 1);
  IF last_appeal->>'status' <> 'granted' OR COALESCE((last_appeal->>'reopened')::boolean, false) THEN
    RAISE EXCEPTION 'The judge has not granted an appeal that is waiting to be reopened';
  END IF;

  SELECT * INTO v FROM verdicts WHERE session_id = p_session_id ORDER BY delivered_at DESC LIMIT 1;
  history := COALESCE(st->'appealHistory', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'appeal', n,
    'verdict', CASE WHEN v.id IS NULL THEN NULL ELSE to_jsonb(v) END,
    'juryVotes', st->'juryVotes',
    'archived_at', now()
  ));

  -- take back the old verdict's win credit; the new verdict credits its winner
  FOR w IN SELECT user_id FROM case_winners WHERE session_id = p_session_id LOOP
    DELETE FROM case_winners WHERE session_id = p_session_id AND user_id = w.user_id;
    SELECT count(*) INTO total FROM case_winners WHERE user_id = w.user_id;
    UPDATE user_profiles
    SET wins_count = total, current_level = public.level_title_for_wins(total)
    WHERE user_id = w.user_id;
  END LOOP;

  DELETE FROM verdicts WHERE session_id = p_session_id;

  appeals := jsonb_set(appeals, ARRAY[(n - 1)::text], last_appeal || jsonb_build_object('reopened', true));

  st := (st - 'phaseTimeRemaining' - 'totalTimeRemaining' - 'juryVotes')
        || jsonb_build_object('appeals', appeals, 'appealHistory', history, 'appealRound', n, 'verdictAccepted', false);

  UPDATE case_sessions
  SET current_phase = 'pre-trial',
      current_trial_phase = 7,
      completed_at = NULL,
      timer_started_at = NULL,
      timer_paused_at = NULL,
      total_pause_duration = 0,
      phase_start_times = '{}'::jsonb,
      session_state = st,
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_case_for_appeal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reopen_case_for_appeal(uuid) TO authenticated;
