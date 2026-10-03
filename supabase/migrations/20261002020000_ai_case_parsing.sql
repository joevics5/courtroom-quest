/*
  # AI case parsing for players (PDF / text -> custom case)

  1. Private 'case-documents' bucket for uploaded PDFs. Each user can only touch
     their own folder (<user id>/...). The edge function reads the file with the
     caller's JWT and deletes it once parsing is done.
  2. case_ai_usage + consume_case_ai_quota(): per-user rate limit for the Gemini
     calls (admins are exempt). The limit lives in SQL so clients cannot raise it.
  3. Owners of a custom (non-preset) case may manage its *_secrets rows, so the
     AI analysis (loopholes, contradictions, weak points) is stored with the case.
     Other players still cannot read these tables.
*/

-- 1. Private bucket for uploads -------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-documents', 'case-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "case_documents_insert_own" ON storage.objects;
CREATE POLICY "case_documents_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "case_documents_select_own" ON storage.objects;
CREATE POLICY "case_documents_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "case_documents_delete_own" ON storage.objects;
CREATE POLICY "case_documents_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Rate limit -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  stage text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_ai_usage_user_time_idx ON public.case_ai_usage (user_id, created_at DESC);
ALTER TABLE public.case_ai_usage ENABLE ROW LEVEL SECURITY; -- no policies: only the function below touches it

-- One case = 2 calls (case, then evidence/analysis). 16 calls / 24 h = 8 generations with room for a retry.
CREATE OR REPLACE FUNCTION public.consume_case_ai_quota(p_stage text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_used integer;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('case_ai:' || v_uid::text));
  SELECT count(*) INTO v_used FROM public.case_ai_usage
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_used >= 16 THEN RETURN false; END IF;
  INSERT INTO public.case_ai_usage (user_id, stage) VALUES (v_uid, left(coalesce(p_stage, ''), 20));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_case_ai_quota(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_case_ai_quota(text) TO authenticated;

-- 3. Owners manage the secrets of their own custom cases ---------------------------
DROP POLICY IF EXISTS "Owners manage case_secrets" ON public.case_secrets;
CREATE POLICY "Owners manage case_secrets" ON public.case_secrets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false));

DROP POLICY IF EXISTS "Owners manage witness_secrets" ON public.witness_secrets;
CREATE POLICY "Owners manage witness_secrets" ON public.witness_secrets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = witness_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = witness_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false));

DROP POLICY IF EXISTS "Owners manage evidence_secrets" ON public.evidence_secrets;
CREATE POLICY "Owners manage evidence_secrets" ON public.evidence_secrets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = evidence_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = evidence_secrets.case_id AND c.created_by = auth.uid() AND c.is_preset = false));
