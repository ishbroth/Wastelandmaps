-- The home vault you can enter once its snapshot is bought and it is cleared: rooms built and furnished from loot, settlers, and their happiness.
-- The whole vault is one document per person; the server (the vault function) works out every change and is the only thing that writes it, spending the
-- loot in the same step, so neither the rooms nor the loot can be faked from the browser.

create table public.home_vault (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.home_vault enable row level security;
create policy "own vault" on public.home_vault for select to authenticated using (user_id = auth.uid());

-- Saves a new state and takes the cost ({"steel": 2, "gears": 2}) out of the loot in one step. p_version is the version the new state was worked out from:
-- if the vault has changed since (a second device), nothing happens. Returns { ok, version } or { ok: false, reason: 'loot' | 'stale' }.
create function public.vault_commit(p_user uuid, p_state jsonb, p_cost jsonb, p_version integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  have integer;
  v integer;
begin
  select version into have from home_vault where user_id = p_user for update;
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
  insert into home_vault (user_id, state, version) values (p_user, p_state, v)
    on conflict (user_id) do update set state = excluded.state, version = excluded.version, updated_at = now();
  return jsonb_build_object('ok', true, 'version', v);
end $$;

revoke all on function public.vault_commit(uuid, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.vault_commit(uuid, jsonb, jsonb, integer) to service_role;
