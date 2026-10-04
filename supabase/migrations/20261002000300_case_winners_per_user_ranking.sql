/*
  # Winners: one row per player, ranked by number of wins

  - case_winners.session_id ties each win to the game that earned it; a unique
    index (user_id, session_id) means one game can only ever count once.
  - Removes duplicate rows created when one verdict fired several times (same
    player, case and score within 10 seconds of an earlier identical row).
  - get_case_top_winners(case_id): one row per player with their win count, best
    score and latest win. Ordered by most wins first, then most recent win.
*/

ALTER TABLE case_winners ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES case_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS case_winners_user_session_uidx
  ON case_winners (user_id, session_id)
  WHERE session_id IS NOT NULL;

DELETE FROM case_winners w
USING case_winners e
WHERE e.user_id = w.user_id
  AND e.case_id = w.case_id
  AND e.verdict_score = w.verdict_score
  AND e.won_at < w.won_at
  AND w.won_at - e.won_at < interval '10 seconds';

CREATE OR REPLACE FUNCTION get_case_top_winners(p_case_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  username text,
  level_achieved text,
  wins bigint,
  best_score integer,
  last_won_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    w.user_id,
    (array_agg(w.username ORDER BY w.won_at DESC))[1],
    (array_agg(w.level_achieved ORDER BY w.won_at DESC))[1],
    count(*),
    max(w.verdict_score),
    max(w.won_at)
  FROM case_winners w
  WHERE w.case_id = p_case_id
  GROUP BY w.user_id
  ORDER BY count(*) DESC, max(w.won_at) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_case_top_winners(uuid, integer) TO authenticated;
