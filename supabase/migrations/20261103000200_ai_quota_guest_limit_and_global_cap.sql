/*
  Tighter AI abuse protection for ai-generate (already applied to the project):
  - guests (anonymous sign-ins) get 400 calls / 24 h, registered users keep 1200
  - a global circuit breaker: once ALL users together pass 30,000 calls in 24 h the
    function answers 'global' (ai-generate shows a "busy" message), which caps
    worst-case Gemini spend if guest accounts are mass-created.
  Raise or lower the numbers below as traffic grows.
*/
CREATE INDEX IF NOT EXISTS ai_call_usage_time_idx ON public.ai_call_usage (created_at DESC);

CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_minute integer;
  v_day integer;
  v_global integer;
  v_anon boolean;
  v_day_limit integer;
  c_global_limit constant integer := 30000;
BEGIN
  IF v_uid IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF public.is_admin() THEN RETURN 'ok'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_calls:' || v_uid::text));

  SELECT COALESCE(is_anonymous, false) INTO v_anon FROM auth.users WHERE id = v_uid;
  v_day_limit := CASE WHEN COALESCE(v_anon, false) THEN 400 ELSE 1200 END;

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'), count(*)
    INTO v_minute, v_day
    FROM public.ai_call_usage
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_minute >= 30 THEN RETURN 'minute'; END IF;
  IF v_day >= v_day_limit THEN RETURN 'day'; END IF;

  SELECT count(*) INTO v_global FROM public.ai_call_usage WHERE created_at > now() - interval '24 hours';
  IF v_global >= c_global_limit THEN RETURN 'global'; END IF;

  INSERT INTO public.ai_call_usage (user_id) VALUES (v_uid);
  IF random() < 0.02 THEN
    DELETE FROM public.ai_call_usage WHERE created_at < now() - interval '2 days';
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;
