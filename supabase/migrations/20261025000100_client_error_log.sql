/*
  Lightweight error monitoring: the app reports crashes and unhandled errors here.
  - client_errors: readable by admins only (no insert policy: rows are written by report_client_error)
  - report_client_error(): signed-in users (incl. guests) may log up to 20 errors / hour, text is length-capped
*/
CREATE TABLE IF NOT EXISTS public.client_errors (
  id bigserial PRIMARY KEY,
  user_id uuid,
  message text NOT NULL,
  stack text,
  context text,
  url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_errors_time_idx ON public.client_errors (created_at DESC);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read client_errors" ON public.client_errors;
CREATE POLICY "Admins read client_errors" ON public.client_errors
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.report_client_error(
  p_message text, p_stack text DEFAULT NULL, p_context text DEFAULT NULL,
  p_url text DEFAULT NULL, p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR coalesce(p_message, '') = '' THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.client_errors
        WHERE user_id = v_uid AND created_at > now() - interval '1 hour') >= 20 THEN RETURN; END IF;
  INSERT INTO public.client_errors (user_id, message, stack, context, url, user_agent)
  VALUES (v_uid, left(p_message, 500), left(p_stack, 4000), left(p_context, 200), left(p_url, 300), left(p_user_agent, 300));
  IF random() < 0.02 THEN
    DELETE FROM public.client_errors WHERE created_at < now() - interval '30 days';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.report_client_error(text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_client_error(text, text, text, text, text) TO authenticated;
