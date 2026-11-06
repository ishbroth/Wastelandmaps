-- The leaderboard: the top survivors by level, then by how many places they have discovered (the places they found, plus the ones they unlocked a snapshot of;
-- a place that is both counts once). A survivor appears only if they joined, and only under a made-up callsign: never an email, and never the vault number (that is the
-- first part of their password). Callsigns are made by the server from word lists, so there is no free text to moderate. The table has no policies: everything goes
-- through the functions below.

create table public.leaderboard_names (
  user_id uuid primary key references auth.users (id) on delete cascade,
  callsign text not null unique,
  joined_at timestamptz not null default now()
);
alter table public.leaderboard_names enable row level security;

-- Joins (or, with p_reroll, picks a new callsign) for the signed-in survivor, and says what the callsign is.
create function public.leaderboard_join(p_reroll boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  adjectives text[] := array['Rusty', 'Glowing', 'Feral', 'Irradiated', 'Lone', 'Dusty', 'Hollow', 'Scorched', 'Ashen', 'Wandering', 'Salvaged', 'Bitter', 'Silent', 'Mutant', 'Atomic', 'Grim', 'Patched', 'Cracked', 'Sunburnt', 'Restless'];
  nouns text[] := array['Wanderer', 'Mongoose', 'Courier', 'Scavenger', 'Raider', 'Ghoul', 'Settler', 'Ranger', 'Drifter', 'Scribe', 'Hound', 'Tinker', 'Brahmin', 'Sentinel', 'Nomad', 'Prospector', 'Trader', 'Mechanic', 'Survivor', 'Radroach'];
  candidate text;
  tries integer := 0;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not p_reroll then
    select callsign into candidate from leaderboard_names where user_id = uid;
    if candidate is not null then return candidate; end if;
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

-- Leaves the leaderboard.
create function public.leaderboard_leave() returns void
language sql security definer set search_path = public as $$
  delete from leaderboard_names where user_id = auth.uid();
$$;

-- The top survivors (at most 200): rank, callsign, level, places, and whether the row is the caller's own. Anyone may look, signed in or not.
create function public.leaderboard_top(p_limit integer default 100)
returns table (rank bigint, callsign text, level integer, places integer, mine boolean)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from (select d.place_id from discoveries d where d.user_id = n.user_id union select u.place_id from unlocks u where u.user_id = n.user_id) p) as places
    from leaderboard_names n
  ), scored as (
    select user_id, callsign, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  )
  select (rank() over (order by level desc, places desc, pts desc))::bigint, callsign, level, places::integer, (user_id = auth.uid())
  from scored
  order by 1, callsign
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

-- The caller's own place on the board (no row if they have not joined), even when they are further down than the list shows.
create function public.leaderboard_me()
returns table (rank bigint, callsign text, level integer, places integer)
language sql stable security definer set search_path = public as $$
  with stats as (
    select n.user_id, n.callsign,
           coalesce((select sum(d.points) from discoveries d where d.user_id = n.user_id), 0) as pts,
           (select count(*) from (select d.place_id from discoveries d where d.user_id = n.user_id union select u.place_id from unlocks u where u.user_id = n.user_id) p) as places
    from leaderboard_names n
  ), scored as (
    select user_id, callsign, pts, places, floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9)::integer as level from stats
  ), ranked as (
    select user_id, callsign, level, places::integer as places, (rank() over (order by level desc, places desc, pts desc))::bigint as rank from scored
  )
  select rank, callsign, level, places from ranked where user_id = auth.uid();
$$;

revoke all on function public.leaderboard_join(boolean) from public, anon;
revoke all on function public.leaderboard_leave() from public, anon;
revoke all on function public.leaderboard_me() from public, anon;
revoke all on function public.leaderboard_top(integer) from public;
grant execute on function public.leaderboard_join(boolean) to authenticated;
grant execute on function public.leaderboard_leave() to authenticated;
grant execute on function public.leaderboard_me() to authenticated;
grant execute on function public.leaderboard_top(integer) to anon, authenticated;
