/*
  Security fix: users could update their own user_profiles row freely, including
  is_admin, subscription_tier, voice_minutes_remaining, wins_count, current_level
  and case_creation_count. The RLS policy only checks user_id.

  This trigger pins those columns for requests made through the API (roles
  authenticated / anon). SECURITY DEFINER functions (win recording, signup),
  the SQL editor and the service role are unaffected.
  Players can still change difficulty, tutorial_completed and trial_count.
  (Already applied to the project.)
*/
CREATE OR REPLACE FUNCTION public.protect_user_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.subscription_tier := 'free';
    NEW.voice_minutes_remaining := 0;
    NEW.wins_count := 0;
    NEW.current_level := public.level_title_for_wins(0);
    NEW.case_creation_count := 0;
  ELSE
    NEW.is_admin := OLD.is_admin;
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.voice_minutes_remaining := OLD.voice_minutes_remaining;
    NEW.wins_count := OLD.wins_count;
    NEW.current_level := OLD.current_level;
    NEW.case_creation_count := OLD.case_creation_count;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_profile_columns ON public.user_profiles;
CREATE TRIGGER protect_user_profile_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_columns();
