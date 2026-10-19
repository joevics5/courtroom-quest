-- Private descriptions of what an image/media shows, for the AI attorneys only.
-- The UI never renders these columns.
alter table public.evidence add column if not exists ai_description text;
alter table public.witnesses add column if not exists photo_description text;
comment on column public.evidence.ai_description is 'AI-only: what the evidence image/media shows. Never shown to players.';
comment on column public.witnesses.photo_description is 'AI-only: what the witness photo shows. Never shown to players.';
