-- Progress: Atlas. Who made each render first, where each render is (its metro), where a home sits when it is one of the pre-plotted places, and the two counts the
-- Pip-Boy shows (how much has been rendered per metro, and who has discovered the most).

alter table public.renders add column if not exists metro_id text;
alter table public.renders add column if not exists discovered_by uuid references auth.users (id) on delete set null;
create index if not exists renders_metro on public.renders (metro_id) where status = 'ready';

-- A home that is one of the pre-plotted places: its id ("wd:Q..."), and the metro it is in.
alter table public.user_home add column if not exists preplotted_id text;
alter table public.user_home add column if not exists home_metro text;

-- How many pre-plotted places have a finished render, per metro (anyone may look; no names).
create or replace function public.atlas_rendered_counts()
returns table (metro_id text, n integer)
language sql stable security definer set search_path = public as $$
  select r.metro_id, count(*)::integer from renders r where r.status = 'ready' and r.metro_id is not null and r.place_id like 'wd:%' group by r.metro_id;
$$;

-- The top discoverers by callsign: places found (not their own typed-in addresses), plus a home that is itself a pre-plotted place. Only survivors on the leaderboard
-- (they have a callsign) appear, and someone with nothing but their own vault is left out. With p_metro, only that metro counts.
create or replace function public.atlas_contributors(p_metro text default null, p_limit integer default 100)
returns table (callsign text, n integer)
language sql stable security definer set search_path = public as $$
  with found as (
    select f.user_id, count(*)::integer as c from found_places f
    where f.place_id not like 'me:%' and (p_metro is null or f.metro_id = p_metro) group by f.user_id
  ), homes as (
    select h.user_id, 1 as c from user_home h
    where h.preplotted_id is not null and (p_metro is null or h.home_metro = p_metro)
      and not exists (select 1 from found_places f where f.user_id = h.user_id and f.place_id = h.preplotted_id)
  ), totals as (
    select user_id, sum(c)::integer as n from (select * from found union all select * from homes) t group by user_id
  )
  select n.callsign, t.n from totals t join leaderboard_names n on n.user_id = t.user_id
  where t.n > 0 order by t.n desc, n.callsign limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.atlas_rendered_counts() from public;
revoke all on function public.atlas_contributors(text, integer) from public;
grant execute on function public.atlas_rendered_counts() to anon, authenticated;
grant execute on function public.atlas_contributors(text, integer) to anon, authenticated;
