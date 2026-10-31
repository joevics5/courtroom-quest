-- Admin-only note: which real-world case a fictionalized case is inspired by.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS reference text;

COMMENT ON COLUMN public.cases.reference IS 'Real-world case this fictionalized case is inspired by (for the admin). All names and facts in the case itself are invented.';
