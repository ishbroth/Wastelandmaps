-- Wipes one account back to the start, for testing: every discovered place, snapshot, cleared place, bit of loot awarded, gun, stimpak, vault, vacation vault,
-- leaderboard name and position, EXCEPT what is kept below. Run it once in the Supabase SQL editor. It stops (and changes nothing) if the account is not found.
--
-- KEPT: the login (email, vault-number password), the home (address, vault number, and that it is discovered: its discovery and found rows and its personal place),
--       the home's own picture and its snapshot unlock, the caps and the loot on hand (the admin account keeps them full), the admin flag.
-- WIPED: everything else: the home is NOT cleared any more and its vault game starts over.
do $$
declare
  me constant text := 'iw@sdcarealty.com';
  u uuid;
  home text;
  n integer;
begin
  select id into u from auth.users where lower(email) = me;
  if u is null then raise exception 'no account for %', me; end if;
  select place_id into home from user_home where user_id = u;

  delete from discoveries where user_id = u and (home is null or place_id <> 'me:' || home);
  get diagnostics n = row_count; raise notice 'discoveries removed: %', n;
  delete from found_places where user_id = u and (home is null or place_id <> 'me:' || home);
  get diagnostics n = row_count; raise notice 'found places removed: %', n;
  delete from personal_places where user_id = u and (home is null or place_id <> home);
  get diagnostics n = row_count; raise notice 'personal places removed: %', n;
  delete from unlocks where user_id = u and place_id not like 'vault:%';   -- the home's own snapshot unlock stays with its picture
  get diagnostics n = row_count; raise notice 'snapshot unlocks removed: %', n;
  delete from metro_unlocks where user_id = u;
  delete from metro_clears where user_id = u;
  delete from raid_runs where user_id = u;       -- the cleared places, and the loot waiting at them
  get diagnostics n = row_count; raise notice 'raids removed: %', n;
  delete from player_weapons where user_id = u;
  delete from player_stimpaks where user_id = u;
  delete from player_time where user_id = u;
  delete from home_vault where user_id = u;       -- the home vault's rooms and every vacation vault's
  delete from vacation_vault where user_id = u;
  delete from leaderboard_names where user_id = u;
  delete from map_positions where user_id = u;
  delete from credit_ledger where user_id = u;
  if to_regclass('public.discovery_checks') is not null then delete from discovery_checks where user_id = u; end if;   -- where they were last seen discovering (the speed check)
  raise notice 'done: % is back at the start (home kept, not cleared)', me;
end $$;
