/*
  # Rebalance case fees: a 30-50 base, with a premium on the harder side

  Base fee by difficulty: easy 30, medium 40, hard 50 (the first version used 40/80/120 and a bonus for
  cases with few plays; that bonus is gone so the numbers stay predictable).

  The harder side of each case earns a premium: +25% (tough_level 1, a lean) or +50% (tough_level 2, clearly
  harder), rounded to the nearest 5. Which side is harder was judged case by case from the case file: the side
  the hidden truth works against, and who carries the burden of proof. Roughly:
    - the accused is innocent or the evidence is thin  -> prosecution is the harder side
    - the accuser is plainly right                     -> defense is the harder side
    - both sides are about equal                       -> no premium

  Once a case has 10+ decided games, real results take over from that judgment: a side that wins under half
  the time earns up to +50%.

  cases.prosecution_fee / defense_fee still override everything, for manual tuning.
*/

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS tough_side text CHECK (tough_side IN ('prosecution', 'defense')),
  ADD COLUMN IF NOT EXISTS tough_level smallint NOT NULL DEFAULT 0 CHECK (tough_level BETWEEN 0 AND 2);

UPDATE public.cases c
SET tough_side = v.side, tough_level = v.lvl
FROM (VALUES
  ('A&M Records v. Napster', 'defense', 1),
  ('AI vs Artist', 'prosecution', 1),
  ('Blac Chyna v. Kardashians', 'prosecution', 2),
  ('Broke Best Friend', 'defense', 1),
  ('Brown v. Board of Education', 'defense', 2),
  ('Cancel Contract', 'prosecution', 1),
  ('Co-Founder Fallout', 'defense', 1),
  ('Dating App Catfish', 'prosecution', 2),
  ('Depp v. Heard', 'prosecution', 1),
  ('Epic v. Apple', 'prosecution', 1),
  ('Gideon v. Wainwright', 'prosecution', 2),
  ('Lohan v. Take-Two Interactive', 'prosecution', 2),
  ('Miller v. California', 'prosecution', 1),
  ('Oracle v. Google', 'prosecution', 1),
  ('Roe v. Wade', 'defense', 1),
  ('Roommate From Hell', 'defense', 2),
  ('State vs The Influencer', 'prosecution', 2),
  ('The Airbnb Disaster', 'defense', 1),
  ('The Amanda Knox Case', 'prosecution', 2),
  ('The Bake Sale Treasurer', 'prosecution', 2),
  ('The Bar Fight', 'prosecution', 2),
  ('The Breonna Taylor Case', 'defense', 1),
  ('The Casey Anthony Trial', 'prosecution', 2),
  ('The Central Park Five Case', 'prosecution', 2),
  ('The Conspiracy', 'prosecution', 2),
  ('The Contested Will', 'prosecution', 2),
  ('The Corporate Fraud', 'prosecution', 2),
  ('The Counterfeit Tickets', 'prosecution', 2),
  ('The Crypto Bro', 'defense', 2),
  ('The Doctor''s Note', 'prosecution', 2),
  ('The Dog Park Bite', 'prosecution', 2),
  ('The Dropshipping Lie', 'defense', 2),
  ('The Elizabeth Holmes Trial', 'defense', 2),
  ('The Fake Review', 'defense', 1),
  ('The Fallen Oak', 'prosecution', 2),
  ('The Field Fire', 'prosecution', 2),
  ('The Food Truck Split', 'prosecution', 2),
  ('The FTX Collapse Trial', 'defense', 1),
  ('The Gallery Heist', 'prosecution', 2),
  ('The Ghosted Caterer', 'prosecution', 1),
  ('The Group Chat Leak', 'prosecution', 1),
  ('The Hot Coffee Case', 'defense', 1),
  ('The Kyle Rittenhouse Trial', 'prosecution', 2),
  ('The Landlord''s Deposit', 'defense', 2),
  ('The Late-Night Stop', 'prosecution', 2),
  ('The Leaked Patient File', 'prosecution', 2),
  ('The Lottery Pool', 'defense', 2),
  ('The Meme Thief', 'defense', 1),
  ('The Midnight Burglary', 'prosecution', 2),
  ('The Missing Package', 'prosecution', 2),
  ('The Murder Mystery', 'prosecution', 2),
  ('The NDA Breaker', 'defense', 1),
  ('The O.J. Simpson Murder Trial', 'prosecution', 1),
  ('The Office Lunch Thief', 'defense', 1),
  ('The Painted-Over Mural', 'prosecution', 2),
  ('The Parking Lot Hit-and-Run', 'prosecution', 2),
  ('The Pharmacy Dose', 'defense', 1),
  ('The Playlist Plagiarist', 'defense', 1),
  ('The Restaurant Fire', 'prosecution', 2),
  ('The Self-Checkout Mix-Up', 'prosecution', 2),
  ('The Short Till', 'prosecution', 2),
  ('The Source Code', 'prosecution', 2),
  ('The Stolen E-Bike', 'prosecution', 2),
  ('The Used Car Lemon', 'prosecution', 2),
  ('The Warehouse Accident', 'defense', 1),
  ('The Wrong Man', 'prosecution', 2),
  ('Tinker v. Des Moines', 'defense', 2),
  ('WiFi Wars', 'defense', 2)
) AS v(title, side, lvl)
WHERE c.is_preset AND c.title = v.title;
-- Left at no premium on purpose (both sides about equal): The Parking Spot, The Verdict Challenge.

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
           (CASE WHEN c.tough_side = 'prosecution' THEN 0.25 * c.tough_level ELSE 0 END) AS pro_manual,
           (CASE WHEN c.tough_side = 'defense' THEN 0.25 * c.tough_level ELSE 0 END) AS def_manual
    FROM public.cases c
    LEFT JOIN rates r ON r.case_id = c.id
    WHERE p_case_id IS NULL OR c.id = p_case_id
  )
  SELECT id,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(pro_override,
                (round(base * (1 + CASE WHEN pw + dw >= 10
                                        THEN least(0.5, greatest(0, 0.5 - pw::numeric / (pw + dw)))
                                        ELSE pro_manual END) / 5) * 5)::integer)
         END,
         CASE WHEN NOT COALESCE(is_preset, false) THEN 0
              ELSE COALESCE(def_override,
                (round(base * (1 + CASE WHEN pw + dw >= 10
                                        THEN least(0.5, greatest(0, 0.5 - dw::numeric / (pw + dw)))
                                        ELSE def_manual END) / 5) * 5)::integer)
         END
  FROM calc
$$;

REVOKE ALL ON FUNCTION public.case_base_fees(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.case_base_fees(uuid) TO anon, authenticated;
