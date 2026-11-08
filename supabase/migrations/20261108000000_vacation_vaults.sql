-- Vacation vaults: after ten rooms in the home vault, a person can turn up to four places they have discovered (outside the home metro) into extra vaults. Each has its own
-- vault document (the same home_vault table, now keyed by user and vault), its own re-rendered picture with a vault door in it, and the map shows it as a cog with the
-- place's old icon inside. The vault function and the vacation-vault function are the only things that write these.

-- one vault document per person AND per vault: 'home' for the home vault, the place id for a vacation vault
alter table public.home_vault add column if not exists vault_key text not null default 'home';
alter table public.home_vault drop constraint if exists home_vault_pkey;
alter table public.home_vault add primary key (user_id, vault_key);

create table if not exists public.vacation_vault (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  name text not null,
  -- the place's own icon (what the cog on the map has inside it)
  icon text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'generating',
  storage_path text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.vacation_vault enable row level security;
drop policy if exists "own vacations" on public.vacation_vault;
create policy "own vacations" on public.vacation_vault for select to authenticated using (user_id = auth.uid());

-- Saves a new state and takes the cost out of the loot in one step (as before), now for either kind of vault.
drop function if exists public.vault_commit(uuid, jsonb, jsonb, integer);
create function public.vault_commit(p_user uuid, p_state jsonb, p_cost jsonb, p_version integer, p_key text default 'home') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  have integer;
  v integer;
begin
  select version into have from home_vault where user_id = p_user and vault_key = p_key for update;
  if have is null then
    if p_version <> 0 then return jsonb_build_object('ok', false, 'reason', 'stale'); end if;
  elsif have <> p_version then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  for k in select jsonb_object_keys(p_cost) loop
    if coalesce((select qty from player_loot where user_id = p_user and loot = k), 0) < (p_cost ->> k)::integer then
      return jsonb_build_object('ok', false, 'reason', 'loot');
    end if;
  end loop;
  for k in select jsonb_object_keys(p_cost) loop
    update player_loot set qty = qty - (p_cost ->> k)::integer where user_id = p_user and loot = k;
  end loop;
  v := coalesce(have, 0) + 1;
  insert into home_vault (user_id, vault_key, state, version) values (p_user, p_key, p_state, v)
    on conflict (user_id, vault_key) do update set state = excluded.state, version = excluded.version, updated_at = now();
  return jsonb_build_object('ok', true, 'version', v);
end $$;
revoke all on function public.vault_commit(uuid, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.vault_commit(uuid, jsonb, jsonb, integer, text) to service_role;

-- Starts a vacation vault: checks the person has no more than three already, and that the place is not one of them, then claims the row (status 'generating').
-- Returns 'ok', 'full' (four already), 'have' (this place already is one) or 'busy' (it is being made right now).
create or replace function public.vacation_claim(p_user uuid, p_place text, p_name text, p_icon text, p_lat double precision, p_lng double precision) returns text
language plpgsql security definer set search_path = public as $$
declare
  existing record;
  mine integer;
begin
  select * into existing from vacation_vault where user_id = p_user and place_id = p_place for update;
  if found then
    if existing.status = 'ready' then return 'have'; end if;
    if existing.status = 'generating' and existing.started_at > now() - interval '150 seconds' then return 'busy'; end if;
    update vacation_vault set status = 'generating', started_at = now(), name = p_name, icon = p_icon, lat = p_lat, lng = p_lng where user_id = p_user and place_id = p_place;
    return 'ok';
  end if;
  select count(*) into mine from vacation_vault where user_id = p_user and status in ('ready', 'generating');
  if mine >= 4 then return 'full'; end if;
  insert into vacation_vault (user_id, place_id, name, icon, lat, lng) values (p_user, p_place, p_name, p_icon, p_lat, p_lng);
  return 'ok';
end $$;
revoke all on function public.vacation_claim(uuid, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.vacation_claim(uuid, text, text, text, double precision, double precision) to service_role;

-- Finishes it: takes the 8 pieces of loot and marks the picture ready, in one step. Returns 'ok' or 'loot' (not enough: nothing is taken and the row is removed).
create or replace function public.vacation_finish(p_user uuid, p_place text, p_cost jsonb, p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare
  k text;
begin
  for k in select jsonb_object_keys(p_cost) loop
    if coalesce((select qty from player_loot where user_id = p_user and loot = k), 0) < (p_cost ->> k)::integer then
      delete from vacation_vault where user_id = p_user and place_id = p_place and status = 'generating';
      return 'loot';
    end if;
  end loop;
  for k in select jsonb_object_keys(p_cost) loop
    update player_loot set qty = qty - (p_cost ->> k)::integer where user_id = p_user and loot = k;
  end loop;
  update vacation_vault set status = 'ready', storage_path = p_path, created_at = now() where user_id = p_user and place_id = p_place;
  return 'ok';
end $$;
revoke all on function public.vacation_finish(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.vacation_finish(uuid, text, jsonb, text) to service_role;
