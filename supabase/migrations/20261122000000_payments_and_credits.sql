/*
  # Payments, subscriptions and trial credits

  Plans (the tier is worked out, never stored by the client):
    guest  signed in anonymously: 3 credits in total, ever
    free   a real account:        2 credits a day (UTC day)
    pro    an active subscription: 100 credits per subscription period

  What each tier may start (checked on the server in start_trial):
    guest / free  5 and 10 minute trials, bench only, easy and medium cases that are not famous
    pro           5, 10, 20 and 30 minute trials, bench and jury, every case
    The retired 15 and 60 minute lengths can no longer be started by anyone.

  A trial costs credits by length: 5 min 1, 10 min 1.5, 20 min 3, 30 min 5. Jury costs nothing extra.
  Allowance credits are use-it-or-lose-it (they come back each day or period). Bonus credits (from coins, packs or
  support) never expire and are spent after the allowance.

  Tables (users can read their own rows; only the server writes):
    subscriptions   one row per user: the plan, its status and period (set by the payment provider's webhook)
    payments        every charge the provider reports; (provider, provider_payment_id) is unique so a repeated
                    webhook can't count twice
    credit_ledger   every spend of a trial and every bonus grant

  Functions:
    credit_cost(minutes), my_credit_status(), start_trial(session, minutes, mode), grant_bonus_credits(...)
*/

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro')),
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider text NOT NULL,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub
  ON public.subscriptions (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'credit_pack', 'other')),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  credits_granted numeric(8, 2) NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS payments_user_time ON public.payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (reason IN ('trial_spend', 'credit_pack', 'coin_swap', 'refund', 'admin')),
  -- Credits taken from the allowance (the daily / monthly / guest credits). Never negative.
  allowance_used numeric(8, 2) NOT NULL DEFAULT 0 CHECK (allowance_used >= 0),
  -- Change to the bonus balance: positive for a grant, negative for a spend.
  bonus_delta numeric(8, 2) NOT NULL DEFAULT 0,
  session_id uuid REFERENCES public.case_sessions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  note text
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_time ON public.credit_ledger (user_id, created_at DESC);
-- A game is charged once.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_one_charge_per_session
  ON public.credit_ledger (session_id) WHERE reason = 'trial_spend' AND session_id IS NOT NULL;
-- A payment grants credits once.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_one_grant_per_payment
  ON public.credit_ledger (payment_id, reason) WHERE payment_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions, public.payments, public.credit_ledger FROM anon, authenticated;
GRANT SELECT ON public.subscriptions, public.payments, public.credit_ledger TO authenticated;
DROP POLICY IF EXISTS "Users read their own subscription" ON public.subscriptions;
CREATE POLICY "Users read their own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read their own payments" ON public.payments;
CREATE POLICY "Users read their own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users read their own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users read their own credit ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
-- No insert/update/delete policies: only the functions below and the service role write.

-- Keep the older user_profiles.subscription_tier column in step with the subscription (the app still reads it).
CREATE OR REPLACE FUNCTION public.sync_subscription_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := COALESCE(NEW.user_id, OLD.user_id);
  is_pro boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid AND s.status IN ('active', 'trialing', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) INTO is_pro;
  UPDATE public.user_profiles SET subscription_tier = CASE WHEN is_pro THEN 'pro' ELSE 'free' END WHERE user_id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS sync_subscription_tier ON public.subscriptions;
CREATE TRIGGER sync_subscription_tier
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_tier();

-- Credits a trial of this length costs. 15 and 60 are the retired lengths: priced, but start_trial refuses them.
CREATE OR REPLACE FUNCTION public.credit_cost(p_minutes integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_minutes WHEN 5 THEN 1 WHEN 10 THEN 1.5 WHEN 20 THEN 3 WHEN 30 THEN 5 WHEN 15 THEN 3 WHEN 60 THEN 8 ELSE NULL END::numeric
$$;

-- Where a user stands: tier, allowance, what is used, bonus, what is left and when the allowance comes back.
CREATE OR REPLACE FUNCTION public._credit_state(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  anon boolean;
  sub record;
  tier text;
  allowance numeric;
  w_start timestamptz;
  w_end timestamptz;
  used numeric;
  bonus numeric;
  left_allowance numeric;
BEGIN
  SELECT COALESCE(is_anonymous, false) INTO anon FROM auth.users WHERE id = p_user;

  SELECT * INTO sub FROM public.subscriptions s
  WHERE s.user_id = p_user AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now());

  IF FOUND THEN
    tier := 'pro';
    allowance := 100;
    IF sub.current_period_start IS NOT NULL AND sub.current_period_end IS NOT NULL THEN
      w_start := sub.current_period_start;
      w_end := sub.current_period_end;
    ELSE
      w_start := date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
      w_end := w_start + interval '1 month';
    END IF;
  ELSIF COALESCE(anon, false) THEN
    tier := 'guest';
    allowance := 3;
    w_start := '-infinity';
    w_end := 'infinity';
  ELSE
    tier := 'free';
    allowance := 2;
    w_start := date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
    w_end := w_start + interval '1 day';
  END IF;

  SELECT COALESCE(sum(allowance_used), 0) INTO used
  FROM public.credit_ledger WHERE user_id = p_user AND created_at >= w_start AND created_at < w_end;
  SELECT COALESCE(sum(bonus_delta), 0) INTO bonus FROM public.credit_ledger WHERE user_id = p_user;

  left_allowance := greatest(0, allowance - used);
  RETURN jsonb_build_object(
    'tier', tier,
    'allowance', allowance,
    'allowance_used', used,
    'allowance_left', left_allowance,
    'bonus', bonus,
    'remaining', left_allowance + bonus,
    'resets_at', CASE WHEN w_end = 'infinity' THEN NULL ELSE w_end END
  );
END;
$$;
REVOKE ALL ON FUNCTION public._credit_state(uuid) FROM public, anon, authenticated;

-- What the app shows: the state plus what this tier may start.
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
    'allowed_minutes', CASE WHEN pro THEN jsonb_build_array(5, 10, 20, 30) ELSE jsonb_build_array(5, 10) END,
    'jury_allowed', pro,
    'all_cases_allowed', pro,
    'costs', jsonb_build_object('5', 1, '10', 1.5, '20', 3, '30', 5)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_credit_status() FROM public;
GRANT EXECUTE ON FUNCTION public.my_credit_status() TO authenticated;

-- Starts a trial: checks this tier may play it and charges its credits, once per game.
-- Returns {ok: true, charged, remaining, tier} or {ok: false, error, ...}. Errors that need an upgrade say so.
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

  -- Already charged: starting again (a reload, a retry) costs nothing more.
  IF EXISTS (SELECT 1 FROM public.credit_ledger WHERE session_id = p_session_id AND reason = 'trial_spend') THEN
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
  INSERT INTO public.credit_ledger (user_id, reason, allowance_used, bonus_delta, session_id, note)
  VALUES (uid, 'trial_spend', from_allowance, -from_bonus, p_session_id, p_mode || ' ' || p_minutes || ' min');

  RETURN jsonb_build_object('ok', true, 'charged', cost, 'already_charged', false,
    'remaining', (st->>'remaining')::numeric - cost, 'tier', tier);
END;
$$;
REVOKE ALL ON FUNCTION public.start_trial(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_trial(uuid, integer, text) TO authenticated;

-- Adds bonus credits (a credit pack, a coin swap, a refund, support). Server only: the payment webhook calls it.
CREATE OR REPLACE FUNCTION public.grant_bonus_credits(
  p_user uuid, p_amount numeric, p_reason text, p_payment_id uuid DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_reason NOT IN ('credit_pack', 'coin_swap', 'refund', 'admin') THEN RAISE EXCEPTION 'bad reason'; END IF;
  INSERT INTO public.credit_ledger (user_id, reason, bonus_delta, payment_id, note)
  VALUES (p_user, p_reason, p_amount, p_payment_id, p_note)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_bonus_credits(uuid, numeric, text, uuid, text) FROM public, anon, authenticated;
