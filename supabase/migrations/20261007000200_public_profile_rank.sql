/*
  # Show a player's rank on their avatar

  Adds `rank_level` (1 to 10) to public_profiles so an opponent's browser can dress their
  avatar for their rank. Kept in step automatically whenever a player's wins change.
*/

CREATE OR REPLACE FUNCTION public.rank_level_for_wins(n integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (CASE
    WHEN n >= 300 THEN 10
    WHEN n >= 200 THEN 9
    WHEN n >= 150 THEN 8
    WHEN n >= 110 THEN 7
    WHEN n >= 75  THEN 6
    WHEN n >= 50  THEN 5
    WHEN n >= 30  THEN 4
    WHEN n >= 15  THEN 3
    WHEN n >= 5   THEN 2
    ELSE 1
  END)::smallint
$$;

ALTER TABLE public.public_profiles
  ADD COLUMN IF NOT EXISTS rank_level smallint NOT NULL DEFAULT 1
  CHECK (rank_level BETWEEN 1 AND 10);

UPDATE public.public_profiles p
SET rank_level = public.rank_level_for_wins(COALESCE(up.wins_count, 0))
FROM public.user_profiles up
WHERE up.user_id = p.user_id;

CREATE OR REPLACE FUNCTION public.sync_public_rank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.public_profiles
  SET rank_level = public.rank_level_for_wins(COALESCE(NEW.wins_count, 0))
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_rank ON public.user_profiles;
CREATE TRIGGER sync_public_rank
  AFTER INSERT OR UPDATE OF wins_count ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_rank();

-- A profile row created later starts at the player's real rank.
CREATE OR REPLACE FUNCTION public.set_public_profile(p_username text DEFAULT NULL, p_avatar jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  clean text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  IF p_username IS NOT NULL THEN
    clean := regexp_replace(btrim(p_username), '\s+', ' ', 'g');
    IF char_length(clean) < 3 OR char_length(clean) > 20 OR position('@' in clean) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid');
    END IF;
  END IF;

  IF p_avatar IS NOT NULL AND (jsonb_typeof(p_avatar) <> 'object' OR pg_column_size(p_avatar) >= 2000) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  BEGIN
    INSERT INTO public.public_profiles (user_id, username, avatar, rank_level, updated_at)
    VALUES (
      uid, clean, p_avatar,
      public.rank_level_for_wins(COALESCE((SELECT wins_count FROM public.user_profiles WHERE user_id = uid), 0)),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET username = COALESCE(EXCLUDED.username, public.public_profiles.username),
          avatar = COALESCE(EXCLUDED.avatar, public.public_profiles.avatar),
          updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'taken');
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_public_profile(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_public_profile(text, jsonb) TO authenticated;
