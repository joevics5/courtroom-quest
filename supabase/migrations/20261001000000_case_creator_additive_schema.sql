-- Case creator: additive schema (already applied to the project via the Supabase MCP).
-- Admin helper
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_profiles where user_id = auth.uid() and is_admin = true);
$$;
grant execute on function public.is_admin() to authenticated;

alter table public.cases
  add column if not exists subtitle text,
  add column if not exists jurisdiction text,
  add column if not exists court_type text,
  add column if not exists location text,
  add column if not exists time_period text,
  add column if not exists estimated_minutes integer,
  add column if not exists min_players integer,
  add column if not exists max_players integer;

alter table public.witnesses
  add column if not exists code text,
  add column if not exists age integer,
  add column if not exists occupation text,
  add column if not exists relationship text;

alter table public.evidence
  add column if not exists code text;

create table if not exists public.case_secrets (
  case_id uuid primary key references public.cases(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  source_story text,
  updated_at timestamptz default now()
);
create table if not exists public.witness_secrets (
  witness_id uuid primary key references public.witnesses(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
create table if not exists public.evidence_secrets (
  evidence_id uuid primary key references public.evidence(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
create index if not exists witness_secrets_case_idx on public.witness_secrets(case_id);
create index if not exists evidence_secrets_case_idx on public.evidence_secrets(case_id);

alter table public.case_secrets enable row level security;
alter table public.witness_secrets enable row level security;
alter table public.evidence_secrets enable row level security;

create policy "Admins manage case_secrets" on public.case_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage witness_secrets" on public.witness_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage evidence_secrets" on public.evidence_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage evidence" on public.evidence
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage witnesses" on public.witnesses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins insert cases" on public.cases
  for insert to authenticated with check (public.is_admin());
create policy "Admins delete cases" on public.cases
  for delete to authenticated using (public.is_admin());
create policy "Admins view all cases" on public.cases
  for select to authenticated using (public.is_admin());
