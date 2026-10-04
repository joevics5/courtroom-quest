/*
  # Record wins on the server when a verdict is delivered

  Until now the browser of whoever was playing wrote the win. That missed a
  player who had closed the app before an online verdict landed. A trigger on
  verdicts now credits every winner, whatever device or tab they are on:

  - vs AI:        the session owner, if their chosen side won
  - vs player:    whichever of the two accounts is on the winning side
  - same device:  the account owner, if their side won (the second player
                  sharing the device has no account)

  A guilty verdict (outcome 'win') is a win for the prosecution, not guilty
  ('lose') for the defense; 'partial' counts for nobody. Each win is tied to its
  game (user_id + session_id unique), so a verdict can never count twice, and
  wins_count / current_level are recomputed from the recorded wins.
*/

CREATE OR REPLACE FUNCTION public.level_title_for_wins(n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN n >= 150 THEN 'Legend of the Bar'
    WHEN n >= 100 THEN 'Supreme Advocate'
    WHEN n >= 75  THEN 'Distinguished Counsel'
    WHEN n >= 50  THEN 'Master Litigator'
    WHEN n >= 30  THEN 'Trial Specialist'
    WHEN n >= 20  THEN 'Senior Counsel'
    WHEN n >= 10  THEN 'Associate Counsel'
    WHEN n >= 5   THEN 'Courtroom Attorney'
    WHEN n >= 3   THEN 'Junior Advocate'
    WHEN n >= 1   THEN 'Practicing Attorney'
    ELSE 'Novice'
  END
$$;

CREATE OR REPLACE FUNCTION public.record_verdict_wins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  s record;
  st jsonb;
  winner uuid;
  owner_role text;
  meta jsonb;
  is_anon boolean;
  pub_name text;
  prior_wins integer;
  total_wins integer;
  inserted integer;
BEGIN
  IF NEW.outcome NOT IN ('win', 'lose') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM case_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  st := COALESCE(s.session_state, '{}'::jsonb);

  IF COALESCE((st->>'sameDevicePlay')::boolean, false) THEN
    owner_role := COALESCE(st->>'creatorRole', 'defense');
    IF (NEW.outcome = 'win' AND owner_role = 'prosecution') OR (NEW.outcome = 'lose' AND owner_role = 'defense') THEN
      winner := s.user_id;
    END IF;
  ELSIF COALESCE((st->>'isMultiplayer')::boolean, false) THEN
    IF NEW.outcome = 'win' THEN
      winner := NULLIF(st->>'prosecutionUserId', '')::uuid;
    ELSE
      winner := NULLIF(st->>'defenseUserId', '')::uuid;
    END IF;
  ELSE
    owner_role := COALESCE(st->>'playerRole', 'defense');
    IF (NEW.outcome = 'win' AND owner_role = 'prosecution') OR (NEW.outcome = 'lose' AND owner_role = 'defense') THEN
      winner := s.user_id;
    END IF;
  END IF;

  IF winner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT raw_user_meta_data, COALESCE(is_anonymous, false) INTO meta, is_anon
  FROM auth.users WHERE id = winner;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  pub_name := COALESCE(
    NULLIF(btrim(meta->>'nickname'), ''),
    NULLIF(btrim(meta->>'full_name'), ''),
    CASE WHEN is_anon THEN 'Guest ' ELSE 'Player ' END || upper(right(replace(winner::text, '-', ''), 4))
  );

  SELECT count(*) INTO prior_wins FROM case_winners WHERE user_id = winner;

  INSERT INTO case_winners (case_id, user_id, username, level_achieved, verdict_score, session_id)
  VALUES (s.case_id, winner, pub_name, public.level_title_for_wins(prior_wins + 1), COALESCE(NEW.score, 0), s.id)
  ON CONFLICT (user_id, session_id) WHERE session_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted > 0 THEN
    SELECT count(*) INTO total_wins FROM case_winners WHERE user_id = winner;
    UPDATE user_profiles
    SET wins_count = total_wins,
        current_level = public.level_title_for_wins(total_wins)
    WHERE user_id = winner;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_wins_on_verdict ON verdicts;
CREATE TRIGGER record_wins_on_verdict
  AFTER INSERT ON verdicts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_verdict_wins();
