/*
  # A game keeps the length and court it was charged for

  start_trial charges a game once. Without this, a player could be charged for a 5 minute bench trial, go back,
  pick a 30 minute jury trial for the same game and have it count as "already charged". Now the ledger remembers
  what the game was charged for, and asking for something different returns 'already_started' with the original
  length and court, which the app then simply uses.
*/

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS minutes smallint,
  ADD COLUMN IF NOT EXISTS mode text;

CREATE OR REPLACE FUNCTION public.start_trial(p_session_id uuid, p_minutes integer, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  c record;
  charged record;
  st jsonb;
  tier text;
  cost numeric;
  from_allowance numeric;
  from_bonus numeric;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credits:' || uid::text));

  SELECT * INTO s FROM public.case_sessions WHERE id = p_session_id AND user_id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'session_not_found'); END IF;

  st := public._credit_state(uid);
  tier := st->>'tier';

  -- Already charged: the same request again (a reload, a retry) costs nothing more; a different one is refused.
  SELECT minutes, mode INTO charged FROM public.credit_ledger WHERE session_id = p_session_id AND reason = 'trial_spend';
  IF FOUND THEN
    IF charged.minutes IS NOT NULL AND (charged.minutes <> p_minutes OR charged.mode IS DISTINCT FROM p_mode) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_started', 'minutes', charged.minutes, 'mode', charged.mode, 'tier', tier);
    END IF;
    RETURN jsonb_build_object('ok', true, 'charged', 0, 'already_charged', true, 'remaining', (st->>'remaining')::numeric, 'tier', tier);
  END IF;

  IF p_mode NOT IN ('judge', 'jury') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_mode'); END IF;
  IF p_minutes NOT IN (5, 10, 20, 30) THEN RETURN jsonb_build_object('ok', false, 'error', 'duration_not_allowed'); END IF;

  IF tier <> 'pro' THEN
    IF p_minutes NOT IN (5, 10) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'duration_locked', 'upgrade_required', true, 'tier', tier);
    END IF;
    IF p_mode = 'jury' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'jury_locked', 'upgrade_required', true, 'tier', tier);
    END IF;
    SELECT difficulty, COALESCE(is_famous, false) AS is_famous INTO c FROM public.cases WHERE id = s.case_id;
    IF FOUND AND (c.is_famous OR c.difficulty = 'hard') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'case_locked', 'upgrade_required', true, 'tier', tier);
    END IF;
  END IF;

  cost := public.credit_cost(p_minutes);
  IF (st->>'remaining')::numeric < cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_credits', 'cost', cost,
      'remaining', (st->>'remaining')::numeric, 'resets_at', st->'resets_at', 'tier', tier);
  END IF;

  from_allowance := least(cost, (st->>'allowance_left')::numeric);
  from_bonus := cost - from_allowance;
  INSERT INTO public.credit_ledger (user_id, reason, allowance_used, bonus_delta, session_id, minutes, mode, note)
  VALUES (uid, 'trial_spend', from_allowance, -from_bonus, p_session_id, p_minutes, p_mode, p_mode || ' ' || p_minutes || ' min');

  RETURN jsonb_build_object('ok', true, 'charged', cost, 'already_charged', false,
    'remaining', (st->>'remaining')::numeric - cost, 'tier', tier);
END;
$$;
REVOKE ALL ON FUNCTION public.start_trial(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_trial(uuid, integer, text) TO authenticated;
