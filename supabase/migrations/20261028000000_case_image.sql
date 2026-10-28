-- Optional thumbnail for case cards. Nothing is shown on a card when this is empty.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.cases.image_url IS 'Optional thumbnail shown on case cards (public image URL). Empty = no thumbnail.';
