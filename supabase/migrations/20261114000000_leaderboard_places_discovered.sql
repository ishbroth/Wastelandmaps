-- The leaderboard's "places" are the places the survivor has discovered (been to), not the ones they only unlocked a snapshot of or cleared from afar.
create or replace function public.leaderboard_top(p_limit integer default 100)
returns table (rank bigint, callsign text, level integer, places integer, mine boolean)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from discoveries d where d.user_id = n.user_id) as places
    from leaderboard_names n
  ), scored as (
    select user_id, callsign, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  )
  select (rank() over (order by level desc, places desc, pts desc))::bigint, callsign, level, places::integer, (user_id = auth.uid())
  from scored
  order by 1, callsign
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

create or replace function public.leaderboard_me()
returns table (rank bigint, callsign text, level integer, places integer)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from discoveries d where d.user_id = n.user_id) as places
    from leaderboard_names n
  ), scored as (
    select user_id, callsign, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  ), ranked as (
    select user_id, callsign, level, places::integer as places, (rank() over (order by level desc, places desc, pts desc))::bigint as rank from scored
  )
  select rank, callsign, level, places from ranked where user_id = auth.uid();
$$;
