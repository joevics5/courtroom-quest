-- "Versus" line for case cards, e.g. "Ella vs. Nelson", shown in brackets under the case title.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS versus text;

COMMENT ON COLUMN public.cases.versus IS 'Who is against whom, shown under the title on case cards, e.g. "Ella vs. Nelson". Empty = nothing shown.';
