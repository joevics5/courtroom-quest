/*
  Abuse protection for the ai-generate edge function.

  - ai_call_usage: one row per AI call (no policies; only the function below touches it)
  - consume_ai_quota(): per-user limits, 30 calls / minute (burst) and 1200 calls / 24 h.
    Admins are exempt. Old rows are pruned opportunistically.
*/
CREATE TABLE IF NOT EXISTS public.ai_call_usage (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_call_usage_user_time_idx ON public.ai_call_usage (user_id, created_at DESC);
ALTER TABLE public.ai_call_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_minute integer;
  v_day integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF public.is_admin() THEN RETURN 'ok'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_calls:' || v_uid::text));
  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'), count(*)
    INTO v_minute, v_day
    FROM public.ai_call_usage
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_minute >= 30 THEN RETURN 'minute'; END IF;
  IF v_day >= 1200 THEN RETURN 'day'; END IF;
  INSERT INTO public.ai_call_usage (user_id) VALUES (v_uid);
  -- housekeeping: keep the table small (roughly 1 in 50 calls)
  IF random() < 0.02 THEN
    DELETE FROM public.ai_call_usage WHERE created_at < now() - interval '2 days';
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;
