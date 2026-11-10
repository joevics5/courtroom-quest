-- Board section for each case, and what is being sought (one entry per count).
alter table public.cases
  add column if not exists case_category text not null default 'normal',
  add column if not exists charges jsonb not null default '[]'::jsonb;

alter table public.cases drop constraint if exists cases_case_category_check;
alter table public.cases add constraint cases_case_category_check check (case_category in ('popular','trendy','normal'));

alter table public.cases drop constraint if exists cases_charges_is_array;
alter table public.cases add constraint cases_charges_is_array check (jsonb_typeof(charges) = 'array');

comment on column public.cases.case_category is 'Board section: popular (real famous cases), trendy (modern everyday-life cases), normal.';
comment on column public.cases.charges is 'What the prosecution / claimant is seeking: array of counts, each {"label": "...", "detail": "..."}.';

update public.cases set case_category = 'popular' where is_famous = true;
-- The counts themselves were filled in per case in the live database.
