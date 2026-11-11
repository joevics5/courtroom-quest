/*
  # Leaderboard score from the winner's own side

  verdicts.score rates the prosecution's case (for a jury, the share of guilty votes). case_winners.verdict_score
  copied it as is, so every defense win (a Not Guilty, which means a low prosecution score) was stored as a low
  score and ranked below every prosecution win on the case leaderboards (they sort by verdict_score).

  From now on the stored score is how strong the court found the winner's own side: the score itself for a
  prosecution win, 100 minus it for a defense win. Existing defense wins are corrected the same way.
*/

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
  win_score integer;
  total_wins integer;
  inserted integer;
  same_device boolean := false;
  win_side text;
  fee integer;
  earned_today integer;
  fb record;
  daily_cap constant integer := 600;
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
    same_device := true;
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

  -- NEW.score rates the PROSECUTION's case. The winner's score is how strong the court found THEIR side:
  -- the score itself for a prosecution win ('win' = guilty), 100 minus it for a defense win ('lose' = not guilty).
  win_score := CASE
    WHEN NEW.score IS NULL THEN 0
    WHEN NEW.outcome = 'win' THEN greatest(0, least(100, NEW.score))
    ELSE 100 - greatest(0, least(100, NEW.score))
  END;

  INSERT INTO case_winners (case_id, user_id, username, level_achieved, verdict_score, session_id)
  VALUES (s.case_id, winner, pub_name, public.level_title_for_wins(prior_wins + 1), win_score, s.id)
  ON CONFLICT (user_id, session_id) WHERE session_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted > 0 THEN
    SELECT count(*) INTO total_wins FROM case_winners WHERE user_id = winner;
    UPDATE user_profiles
    SET wins_count = total_wins,
        current_level = public.level_title_for_wins(total_wins)
    WHERE user_id = winner;

    -- Coin payment: the fee locked in when the game began (games from before coins use today's fee).
    win_side := CASE WHEN NEW.outcome = 'win' THEN 'prosecution' ELSE 'defense' END;
    IF s.coin_fees IS NOT NULL THEN
      fee := COALESCE((s.coin_fees->>win_side)::integer, 0);
    ELSE
      SELECT * INTO fb FROM public.case_base_fees(s.case_id) LIMIT 1;
      fee := CASE WHEN FOUND THEN (CASE WHEN win_side = 'prosecution' THEN fb.prosecution_fee ELSE fb.defense_fee END) ELSE 0 END;
    END IF;

    IF fee > 0 THEN
      IF EXISTS (
        SELECT 1 FROM coin_ledger
        WHERE user_id = winner AND case_id = s.case_id AND reason = 'case_win'
      ) THEN
        fee := round(fee * 0.25)::integer;
      END IF;
      IF same_device THEN
        fee := round(fee * 0.5)::integer;
      END IF;
      fee := greatest(5, fee);

      SELECT COALESCE(sum(amount), 0) INTO earned_today
      FROM coin_ledger
      WHERE user_id = winner AND reason = 'case_win' AND created_at > now() - interval '24 hours';
      fee := least(fee, greatest(0, daily_cap - earned_today));

      IF fee > 0 THEN
        INSERT INTO coin_ledger (user_id, amount, reason, case_id, session_id)
        VALUES (winner, fee, 'case_win', s.case_id, s.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Correct the defense wins already recorded: the first not-guilty verdict of the game is the one that won it.
UPDATE public.case_winners cw
SET verdict_score = 100 - greatest(0, least(100, v.score))
FROM (
  SELECT cw2.id AS winner_row, fv.score
  FROM public.case_winners cw2
  JOIN LATERAL (
    SELECT score, outcome FROM public.verdicts
    WHERE session_id = cw2.session_id AND outcome IN ('win', 'lose')
    ORDER BY delivered_at ASC LIMIT 1
  ) fv ON true
  WHERE fv.outcome = 'lose' AND fv.score IS NOT NULL
) v
WHERE cw.id = v.winner_row;
