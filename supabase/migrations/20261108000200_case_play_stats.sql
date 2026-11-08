-- Play counts per case for the Case Board's Trendy and Popular tabs.
-- Players can only read their own sessions, so the counts come from a function that returns totals only
-- (no user ids, nothing private).
create or replace function public.case_play_stats()
returns table (case_id uuid, plays bigint, plays_7d bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.case_id,
         count(*)::bigint as plays,
         count(*) filter (where s.started_at > now() - interval '7 days')::bigint as plays_7d
  from public.case_sessions s
  group by s.case_id
$$;

revoke all on function public.case_play_stats() from public;
grant execute on function public.case_play_stats() to anon, authenticated;
