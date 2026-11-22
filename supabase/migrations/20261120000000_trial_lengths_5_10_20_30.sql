/*
  # Trial lengths are now 5, 10, 20 and 30 minutes

  - The old "5" was the Quick Play (it always ran about 10 minutes and was labelled that way), so existing games
    with trial_duration 5 become 10, and so do the AI usage rows logged under 5. "5" is now a genuine 5 minute trial.
  - 15 becomes 20 for new games, and 60 is hidden. Games already started with 15 or 60 still play out (the app keeps
    those two lengths, it just no longer offers them).
  - The placeholder default for a new game is now 20 instead of 15.
*/

UPDATE public.case_sessions SET trial_duration = 10 WHERE trial_duration = 5;
UPDATE public.ai_usage_log SET trial_duration = 10 WHERE trial_duration = 5;
ALTER TABLE public.case_sessions ALTER COLUMN trial_duration SET DEFAULT 20;
