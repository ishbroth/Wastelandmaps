-- Takes every vacation vault off iw@sdcarealty.com so they can be made again from scratch: the assignment (which place it is on, its picture record) and the vault's own
-- layout (rooms, furniture, settlers). It also sets 8539 Heatherwood (Savannah) back to "not cleared" so it can be fought again.
-- KEPT: the home vault (vault_key 'home'), the caps and loot on hand, and every address snapshot: nothing in address_renders, home_renders, renders or unlocks is touched,
-- and 8539 Heatherwood stays unlocked, saved and discovered. Nothing is refunded or taken back (loot already paid stays paid).
-- Run once in the Supabase SQL editor. Stops (and changes nothing) if the account or the address is not found.
do $$
declare
  me constant text := 'iw@sdcarealty.com';
  u uuid;
  pid text;
  n_layouts integer;
  n_vaults integer;
  n_runs integer;
begin
  select id into u from auth.users where lower(email) = me;
  if u is null then raise exception 'account % not found: nothing changed', me; end if;

  select place_id into pid from public.personal_places where user_id = u and address ilike '8539 Heatherwood%' limit 1;
  if pid is null then raise exception '8539 Heatherwood not found among this account''s places: nothing changed'; end if;

  delete from public.home_vault where user_id = u and vault_key <> 'home';
  get diagnostics n_layouts = row_count;
  delete from public.vacation_vault where user_id = u;
  get diagnostics n_vaults = row_count;
  -- cleared again from scratch: its fights (and any loot still waiting at it) are forgotten
  delete from public.raid_runs where user_id = u and place_id = 'me:' || pid;
  get diagnostics n_runs = row_count;

  raise notice 'removed % vacation vault(s), % layout(s) and % fight record(s) for 8539 Heatherwood (me:%)', n_vaults, n_layouts, n_runs, pid;
end $$;
