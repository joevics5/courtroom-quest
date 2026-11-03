/*
  Wins are recorded by the record_wins_on_verdict trigger (SECURITY DEFINER).
  The browser no longer inserts into case_winners, so the open insert policy
  only let players write fake wins straight into the table.
  (Already applied to the project.)
*/
DROP POLICY IF EXISTS "Users can add their own wins" ON public.case_winners;
