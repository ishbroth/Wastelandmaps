-- A callsign belongs to the survivor for good (it is the name under the first render of every place they discover). Leaving the leaderboard only takes the name out of the
-- lists (the leaderboard and the top contributors); the callsign itself stays, and joining again puts it back.

alter table public.leaderboard_names add column if not exists listed boolean not null default true;

-- Joins the lists (or, with p_reroll, picks a new callsign and leaves the listing as it was), and says what the callsign is.
create or replace function public.leaderboard_join(p_reroll boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  adjectives text[] := array['Rusty', 'Glowing', 'Feral', 'Irradiated', 'Lone', 'Dusty', 'Hollow', 'Scorched', 'Ashen', 'Wandering', 'Salvaged', 'Bitter', 'Silent', 'Mutant', 'Atomic', 'Grim', 'Patched'];
  nouns text[] := array['Wanderer', 'Mongoose', 'Courier', 'Scavenger', 'Raider', 'Ghoul', 'Settler', 'Ranger', 'Drifter', 'Scribe', 'Hound', 'Tinker', 'Brahmin', 'Sentinel', 'Nomad', 'Prospector'];
  candidate text;
  tries integer := 0;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not p_reroll then
    select callsign into candidate from leaderboard_names where user_id = uid;
    if candidate is not null then
      update leaderboard_names set listed = true where user_id = uid;
      return candidate;
    end if;
  end if;
  loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::integer] || ' ' || nouns[1 + floor(random() * array_length(nouns, 1))::integer] || ' ' || (10 + floor(random() * 90))::integer;
    begin
      insert into leaderboard_names (user_id, callsign) values (uid, candidate)
        on conflict (user_id) do update set callsign = excluded.callsign;
      return candidate;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 30 then raise; end if;
    end;
  end loop;
end $$;

-- Leaves the lists: the callsign stays.
create or replace function public.leaderboard_leave() returns void
language sql security definer set search_path = public as $$
  update leaderboard_names set listed = false where user_id = auth.uid();
$$;

create or replace function public.leaderboard_top(p_limit integer default 100)
returns table (rank bigint, callsign text, level integer, places integer, mine boolean)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from discoveries d where d.user_id = n.user_id) as places
    from leaderboard_names n where n.listed
  ), scored as (
    select user_id, callsign, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  )
  select (rank() over (order by level desc, places desc, pts desc))::bigint, callsign, level, places::integer, (user_id = auth.uid())
  from scored
  order by 1, callsign
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

-- The caller's own callsign and place (rank only while listed; no row if they have no callsign yet).
drop function if exists public.leaderboard_me();
create function public.leaderboard_me()
returns table (rank bigint, callsign text, level integer, places integer, listed boolean)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign, n.listed,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from discoveries d where d.user_id = n.user_id) as places
    from leaderboard_names n
  ), scored as (
    select user_id, callsign, listed, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  ), ranked as (
    select user_id, callsign, listed, level, places::integer as places,
           case when listed then (rank() over (partition by listed order by level desc, places desc, pts desc))::bigint end as rank from scored
  )
  select rank, callsign, level, places, listed from ranked where user_id = auth.uid();
$$;
revoke all on function public.leaderboard_me() from public, anon;
grant execute on function public.leaderboard_me() to authenticated;

-- Top contributors: only listed survivors appear.
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
  where t.n > 0 and n.listed order by t.n desc, n.callsign limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
