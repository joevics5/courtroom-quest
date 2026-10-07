/*
  # Public profiles: unique usernames and shareable avatars

  1. New table `public_profiles` (one row per player)
     - username: unique, ignoring case and surrounding spaces
     - avatar: the player's avatar (jsonb), so an opponent's browser can show it
  2. Security
     - Any signed-in player (guests included) can read; nobody can write directly.
     - Writes go through `set_public_profile`, which only ever edits the caller's own row.
  3. `username_available(name)` for a quick check before saving.
  4. Backfill from existing accounts. Where two accounts already share a nickname, the
     older account keeps it and the other is left unclaimed (its nickname still shows to
     itself; it must pick a free name next time it changes it).
*/

CREATE TABLE IF NOT EXISTS public.public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  username_key text GENERATED ALWAYS AS (lower(btrim(username))) STORED,
  avatar jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_profiles_avatar_is_object CHECK (avatar IS NULL OR jsonb_typeof(avatar) = 'object'),
  CONSTRAINT public_profiles_avatar_small CHECK (avatar IS NULL OR pg_column_size(avatar) < 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS public_profiles_username_key_idx
  ON public.public_profiles (username_key)
  WHERE username_key IS NOT NULL;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in players can read public profiles" ON public.public_profiles;
CREATE POLICY "Signed-in players can read public profiles"
  ON public.public_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Backfill: one row per existing account, with their saved avatar if any.
INSERT INTO public.public_profiles (user_id, avatar)
SELECT u.id,
       CASE WHEN jsonb_typeof(u.raw_user_meta_data->'avatar') = 'object'
                 AND pg_column_size(u.raw_user_meta_data->'avatar') < 2000
            THEN u.raw_user_meta_data->'avatar' END
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- Backfill usernames: the oldest account with a given nickname keeps it.
WITH named AS (
  SELECT u.id,
         btrim(u.raw_user_meta_data->>'nickname') AS nick,
         row_number() OVER (
           PARTITION BY lower(btrim(u.raw_user_meta_data->>'nickname'))
           ORDER BY u.created_at, u.id
         ) AS rn
  FROM auth.users u
  WHERE btrim(coalesce(u.raw_user_meta_data->>'nickname', '')) <> ''
    AND char_length(btrim(u.raw_user_meta_data->>'nickname')) BETWEEN 3 AND 20
)
UPDATE public.public_profiles p
SET username = named.nick
FROM named
WHERE p.user_id = named.id AND named.rn = 1 AND p.username IS NULL;

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
    INSERT INTO public.public_profiles (user_id, username, avatar, updated_at)
    VALUES (uid, clean, p_avatar, now())
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

CREATE OR REPLACE FUNCTION public.username_available(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.public_profiles
    WHERE username_key = lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')))
      AND user_id IS DISTINCT FROM auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.set_public_profile(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_public_profile(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;
