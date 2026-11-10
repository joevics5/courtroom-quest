/*
  # Coins: a fee per case and side, paid on a win

  Coins are virtual (no real money, no purchase, no cash-out). Each preset case pays a fee to whichever side
  you take, shown on the Case Board and when choosing a side.

  - cases.prosecution_fee / defense_fee   optional admin overrides (preset cases only)
  - case_base_fees()                      the fee per side: difficulty base, +up to 50% for a side that rarely
                                          wins (needs 10+ decided games), +20% for a case with under 5 plays
  - case_sessions.coin_fees               fee locked in when a game is created, set by a trigger and pinned
                                          against client edits, so the fee can't change mid-trial or be forged
  - coin_ledger                           every credit, one row each; players can only read their own rows
  - record_verdict_wins()                 now also pays the fee when it records a win:
                                          repeat win of the same case = 25%, same-device game = 50%,
                                          daily cap 600 coins, never paid twice for one game
  - coin_balance(), case_fee_board()      what the app reads

  Custom (non-preset) cases always pay 0, so nobody can write an easy case and farm it.
*/

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS prosecution_fee integer,
  ADD COLUMN IF NOT EXISTS defense_fee integer;

ALTER TABLE public.case_sessions
  ADD COLUMN IF NOT EXISTS coin_fees jsonb;

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.case_sessions(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coin_ledger_win_once
  ON public.coin_ledger (user_id, session_id)
  WHERE reason = 'case_win' AND session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coin_ledger_user_time
  ON public.coin_ledger (user_id, created_at DESC);

ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own coin ledger" ON public.coin_ledger;
CREATE POLICY "Users read their own coin ledger"
  ON public.coin_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- No insert/update/delete policies: only SECURITY DEFINER functions write to the ledger.
-- Spelled out so it doesn't depend on the project's default table privileges.
REVOKE ALL ON public.coin_ledger FROM anon, authenticated;
GRANT SELECT ON public.coin_ledger TO authenticated;

-- The fee of each side, for one case or (p_case_id null) for every case.
CREATE OR REPLACE FUNCTION public.case_base_fees(p_case_id uuid DEFAULT NULL)
RETURNS TABLE (case_id uuid, prosecution_fee integer, defense_fee integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rates AS (
    SELECT s.case_id,
           count(*) FILTER (WHERE v.outcome = 'win')  AS pro_wins,
           count(*) FILTER (WHERE v.outcome = 'lose') AS def_wins
    FROM public.verdicts v
    JOIN public.case_sessions s ON s.id = v.session_id
    WHERE v.outcome IN ('win', 'lose')
      AND (p_case_id IS NULL OR s.case_id = p_case_id)
    GROUP BY s.case_id
  ),
  plays AS (
    SELECT s.case_id, count(*) AS n
    FROM public.case_sessions s
    WHERE p_case_id IS NULL OR s.case_id = p_case_id
    GROUP BY s.case_id
  ),
  calc AS (
    SELECT c.id,
           c.is_preset,
           c.prosecution_fee AS pro_override,
           c.defense_fee AS def_override,
           (CASE c.difficulty WHEN 'easy' THEN 40 WHEN 'hard' THEN 120 ELSE 80 END)::numeric
             * (CASE WHEN COALESCE(p.n, 0) < 5 THEN 1.2 ELSE 1 END) AS base,
           COALESCE(r.pro_wins, 0) AS pw,
           COALESCE(r.def_wins, 0) AS dw
    FROM public.cases c
    LEFT JOIN rates r ON r.case_id = c.id
    LEFT JOIN plays p ON p.case_id = c.id
    WHERE p_case_id IS NULL OR c.id = p_case_id
  )
  SELECT id,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(pro_override,
                (round(base * (CASE WHEN pw + dw >= 10
                                    THEN 1 + least(0.5, greatest(0, 0.5 - pw::numeric / (pw + dw)))
                                    ELSE 1 END) / 5) * 5)::integer)
         END,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(def_override,
                (round(base * (CASE WHEN pw + dw >= 10
                                    THEN 1 + least(0.5, greatest(0, 0.5 - dw::numeric / (pw + dw)))
                                    ELSE 1 END) / 5) * 5)::integer)
         END
  FROM calc
$$;

-- Fees are public information (the board shows them), and the lock trigger below runs as the caller.
REVOKE ALL ON FUNCTION public.case_base_fees(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.case_base_fees(uuid) TO anon, authenticated;

-- What the signed-in player sees on the board: the fees, cut to 25% for a case they have already won.
CREATE OR REPLACE FUNCTION public.case_fee_board()
RETURNS TABLE (case_id uuid, prosecution_fee integer, defense_fee integer, repeat_win boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.case_id,
         CASE WHEN w.case_id IS NOT NULL AND f.prosecution_fee > 0
              THEN greatest(5, round(f.prosecution_fee * 0.25)::integer) ELSE f.prosecution_fee END,
         CASE WHEN w.case_id IS NOT NULL AND f.defense_fee > 0
              THEN greatest(5, round(f.defense_fee * 0.25)::integer) ELSE f.defense_fee END,
         (w.case_id IS NOT NULL)
  FROM public.case_base_fees(NULL) f
  LEFT JOIN (
    SELECT DISTINCT l.case_id FROM public.coin_ledger l
    WHERE l.user_id = auth.uid() AND l.reason = 'case_win' AND l.case_id IS NOT NULL
  ) w ON w.case_id = f.case_id
$$;

REVOKE ALL ON FUNCTION public.case_fee_board() FROM public;
GRANT EXECUTE ON FUNCTION public.case_fee_board() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.coin_balance()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0)::integer FROM public.coin_ledger WHERE user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.coin_balance() FROM public;
GRANT EXECUTE ON FUNCTION public.coin_balance() TO anon, authenticated;

-- Lock the fee in when a game is created. Whatever the client sent is replaced.
-- Not SECURITY DEFINER on purpose: current_user must be the caller's role for the update pin to work.
CREATE OR REPLACE FUNCTION public.lock_session_coin_fees()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  f record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO f FROM public.case_base_fees(NEW.case_id) LIMIT 1;
    NEW.coin_fees := CASE WHEN FOUND
      THEN jsonb_build_object('prosecution', f.prosecution_fee, 'defense', f.defense_fee)
      ELSE NULL END;
  ELSIF current_user IN ('authenticated', 'anon') THEN
    NEW.coin_fees := OLD.coin_fees;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_session_coin_fees ON public.case_sessions;
CREATE TRIGGER lock_session_coin_fees
  BEFORE INSERT OR UPDATE ON public.case_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_session_coin_fees();

-- Win recording (same as before) plus the coin payment.
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
