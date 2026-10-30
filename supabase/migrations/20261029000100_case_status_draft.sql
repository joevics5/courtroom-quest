-- Cases can be switched to 'draft' to hide them from players (admins still see them).
alter table public.cases
  add column if not exists status text not null default 'published';

alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check check (status in ('published', 'draft'));

-- Players only see published preset cases (admins keep full access through their own policy).
drop policy if exists "Preset cases viewable by tier" on public.cases;
create policy "Preset cases viewable by tier" on public.cases
  for select
  using (
    is_preset = true
    and status = 'published'
    and (
      minimum_tier = 'free'
      or exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
          and user_profiles.subscription_tier = any (array['basic','premium','enterprise'])
      )
    )
  );

-- Don't leak a draft's evidence or witnesses to players who guess the case id.
drop policy if exists "Users can view evidence for accessible cases" on public.evidence;
create policy "Users can view evidence for accessible cases" on public.evidence
  for select
  using (exists (
    select 1 from public.cases
    where cases.id = evidence.case_id
      and ((cases.is_preset = true and cases.status = 'published') or cases.created_by = auth.uid())
  ));

drop policy if exists "Users can view witnesses for accessible cases" on public.witnesses;
create policy "Users can view witnesses for accessible cases" on public.witnesses
  for select
  using (exists (
    select 1 from public.cases
    where cases.id = witnesses.case_id
      and ((cases.is_preset = true and cases.status = 'published') or cases.created_by = auth.uid())
  ));
