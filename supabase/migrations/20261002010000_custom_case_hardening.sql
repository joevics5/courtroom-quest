/*
  # Custom case hardening

  1. Storage: public 'witness-photos' bucket. Players upload into their own
     folder (<user id>/...); anyone can read, so opponents and spectators see photos.
  2. cases INSERT: a normal user may only create NON-preset cases. Before, the
     check was only created_by = auth.uid(), so any signed-in user could insert
     is_preset = true and publish a case to everybody.
  3. cases SELECT for anon: was USING (true), exposing every case row (including
     truth_state) to logged-out visitors. Now only cases that belong to a shared or
     spectatable session are readable (that is all the shared transcript page needs).
  4. evidence / witnesses SELECT: match participants, pending invitees and open
     challenges can read the case contents too, so custom cases work in multiplayer.
     Policies query case_sessions / case_invitations / case_challenges directly
     (not cases) to avoid RLS recursion.
*/

-- 1. Storage ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'witness-photos', 'witness-photos', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "witness_photos_read" ON storage.objects;
CREATE POLICY "witness_photos_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'witness-photos');

DROP POLICY IF EXISTS "witness_photos_insert_own" ON storage.objects;
CREATE POLICY "witness_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'witness-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "witness_photos_update_own" ON storage.objects;
CREATE POLICY "witness_photos_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'witness-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'witness-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "witness_photos_delete_own" ON storage.objects;
CREATE POLICY "witness_photos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'witness-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Users cannot create presets -------------------------------------------
DROP POLICY IF EXISTS "Users can create custom cases" ON public.cases;
CREATE POLICY "Users can create custom cases"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_preset = false);

-- 3. Logged-out visitors: only shared / spectatable cases --------------------
DROP POLICY IF EXISTS "cases_select_shared" ON public.cases;
CREATE POLICY "cases_select_shared"
  ON public.cases FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_sessions s
      WHERE s.case_id = cases.id
        AND (s.is_shared = true OR s.allow_spectators = true)
    )
  );

-- 4. Multiplayer: read access to custom case contents ------------------------
CREATE OR REPLACE FUNCTION public.can_read_case_contents(p_case_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM case_sessions s
      WHERE s.case_id = p_case_id
        AND (s.user_id = auth.uid() OR s.opposing_counsel_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM case_invitations i
      WHERE i.case_id = p_case_id
        AND i.status = 'pending'
        AND (
          i.invitee_user_id = auth.uid()
          OR lower(i.invitee_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
    OR EXISTS (
      SELECT 1 FROM case_challenges c
      WHERE c.case_id = p_case_id AND c.status = 'open'
    );
$$;
REVOKE ALL ON FUNCTION public.can_read_case_contents(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_read_case_contents(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants can view evidence" ON public.evidence;
CREATE POLICY "Participants can view evidence"
  ON public.evidence FOR SELECT
  TO authenticated
  USING (is_hidden = false AND public.can_read_case_contents(case_id));

DROP POLICY IF EXISTS "Participants can view witnesses" ON public.witnesses;
CREATE POLICY "Participants can view witnesses"
  ON public.witnesses FOR SELECT
  TO authenticated
  USING (public.can_read_case_contents(case_id));
