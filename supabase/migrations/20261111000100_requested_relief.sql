-- What the prosecution / claimant asks the judge to grant, replacing the per-count `charges` list.
alter table public.cases add column if not exists requested_relief jsonb;
alter table public.cases drop constraint if exists cases_requested_relief_is_object;
alter table public.cases add constraint cases_requested_relief_is_object
  check (requested_relief is null or jsonb_typeof(requested_relief) = 'object');
comment on column public.cases.requested_relief is
  'What the prosecution / claimant asks the judge to grant: {primary, financial, penalty, additional[], basis}. Shown to the player so the defence knows what it is fighting.';

alter table public.cases drop constraint if exists cases_charges_is_array;
alter table public.cases drop column if exists charges;
-- The relief for each case was filled in per case in the live database.
