/*
  # New rank ladder

  Ten ranks by cases won: Junior Counsel (0), Associate Attorney (5), Trial Lawyer (15),
  Senior Attorney (30), Trial Counsel (50), Senior Advocate (75), Lead Attorney (110),
  Principal Counsel (150), Master Advocate (200), Legendary Attorney (300).

  - Replaces public.level_title_for_wins (used by the verdict trigger).
  - New players start as Junior Counsel.
  - Re-ranks every existing player from their recorded wins. Old case_winners rows keep
    the title they had at the time.
*/

CREATE OR REPLACE FUNCTION public.level_title_for_wins(n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN n >= 300 THEN 'Legendary Attorney'
    WHEN n >= 200 THEN 'Master Advocate'
    WHEN n >= 150 THEN 'Principal Counsel'
    WHEN n >= 110 THEN 'Lead Attorney'
    WHEN n >= 75  THEN 'Senior Advocate'
    WHEN n >= 50  THEN 'Trial Counsel'
    WHEN n >= 30  THEN 'Senior Attorney'
    WHEN n >= 15  THEN 'Trial Lawyer'
    WHEN n >= 5   THEN 'Associate Attorney'
    ELSE 'Junior Counsel'
  END
$$;

ALTER TABLE public.user_profiles ALTER COLUMN current_level SET DEFAULT 'Junior Counsel';

UPDATE public.user_profiles
SET current_level = public.level_title_for_wins(COALESCE(wins_count, 0))
WHERE current_level IS DISTINCT FROM public.level_title_for_wins(COALESCE(wins_count, 0));
