/*
  # Widen the fee gap between the harder side and the easier side

  Before: the harder side earned +25% (a lean) or +50% (clearly harder) over the base, so most cases paid
  sides only about 10 coins apart.

  Now: +50% (a lean) or +100% (clearly harder: double), still rounded to the nearest 5.
    easy 30   -> 45 / 60 for the harder side
    medium 40 -> 60 / 80
    hard 50   -> 75 / 100
  The easier side keeps the base fee.

  Once a case has 10+ decided games, real results take over: a side that wins less than half the time earns
  a premium of twice the shortfall, up to +100% (a side that wins 25% of the time earns +50%, one that wins
  none earns +100%). The old formula was the shortfall itself, up to +50%.

  Everything else is unchanged: cases.prosecution_fee / defense_fee still override, repeat wins pay 25%,
  same-device games 50%, daily cap 600.
*/

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
  calc AS (
    SELECT c.id,
           c.is_preset,
           c.prosecution_fee AS pro_override,
           c.defense_fee AS def_override,
           (CASE c.difficulty WHEN 'easy' THEN 30 WHEN 'hard' THEN 50 ELSE 40 END)::numeric AS base,
           COALESCE(r.pro_wins, 0) AS pw,
           COALESCE(r.def_wins, 0) AS dw,
           (CASE WHEN c.tough_side = 'prosecution' THEN 0.5 * c.tough_level ELSE 0 END) AS pro_manual,
           (CASE WHEN c.tough_side = 'defense' THEN 0.5 * c.tough_level ELSE 0 END) AS def_manual
    FROM public.cases c
    LEFT JOIN rates r ON r.case_id = c.id
    WHERE p_case_id IS NULL OR c.id = p_case_id
  )
  SELECT id,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(pro_override,
                (round(base * (1 + CASE WHEN pw + dw >= 10
                                        THEN least(1.0, greatest(0, (0.5 - pw::numeric / (pw + dw)) * 2))
                                        ELSE pro_manual END) / 5) * 5)::integer)
         END,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(def_override,
                (round(base * (1 + CASE WHEN pw + dw >= 10
                                        THEN least(1.0, greatest(0, (0.5 - dw::numeric / (pw + dw)) * 2))
                                        ELSE def_manual END) / 5) * 5)::integer)
         END
  FROM calc
$$;

REVOKE ALL ON FUNCTION public.case_base_fees(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.case_base_fees(uuid) TO anon, authenticated;
