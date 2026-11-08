/*
  # Pre-trial script is part of the pre-trial progress that resets on entry

  The defense publishes the bailiff's lines (pretrialScript) so both players read identical words.
  Like the seats, the plea and the step, it is wiped whenever a case enters the pre-trial, so a case
  sent back to the start of the pre-trial after a granted appeal begins from scratch.
*/

CREATE OR REPLACE FUNCTION public.reset_pretrial_state_on_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.session_state := COALESCE(NEW.session_state, '{}'::jsonb)
    - ARRAY['seatedProsecution', 'seatedDefense', 'pretrialStarted', 'pretrialStep', 'pretrialPlea', 'pretrialScript'];
  RETURN NEW;
END;
$$;
