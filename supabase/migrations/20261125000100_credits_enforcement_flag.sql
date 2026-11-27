/*
  # An on/off switch for credits

  Until Paystack is set up, nobody could buy Pro, so enforcing credits would only lock free players out of the
  long trials with no way to unlock them. The switch app_flags.credits_enforced starts OFF:

    off  start_trial lets everything through without charging, and my_credit_status says enforced = false so the app
         shows no costs, balances or Pro locks.
    on   the credit rules apply.

  Turn it on once payments work:   update public.app_flags set enabled = true where key = 'credits_enforced';
  Turn it off again at any time:   update public.app_flags set enabled = false where key = 'credits_enforced';
*/

CREATE TABLE IF NOT EXISTS public.app_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM anon, authenticated;
INSERT INTO public.app_flags (key, enabled) VALUES ('credits_enforced', false) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._flag_on(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.app_flags WHERE key = p_key), false)
$$;
REVOKE ALL ON FUNCTION public._flag_on(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_credit_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  st jsonb;
  pro boolean;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  st := public._credit_state(uid);
  pro := st->>'tier' = 'pro';
  RETURN st || jsonb_build_object(
    'enforced', public._flag_on('credits_enforced'),
    'allowed_minutes', CASE WHEN pro THEN jsonb_build_array(5, 10, 20, 30) ELSE jsonb_build_array(5, 10) END,
    'jury_allowed', pro,
    'all_cases_allowed', pro,
    'costs', jsonb_build_object('5', 1, '10', 1.5, '20', 3, '30', 5)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_credit_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_credit_status() TO authenticated;

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

  -- Switched off: let the game start, charge nothing, and say so.
  IF NOT public._flag_on('credits_enforced') THEN
    RETURN jsonb_build_object('ok', true, 'charged', 0, 'already_charged', false, 'enforced', false, 'remaining', 0, 'tier', 'free');
  END IF;

  st := public._credit_state(uid);
  tier := st->>'tier';

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
