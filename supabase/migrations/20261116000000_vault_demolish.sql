-- Demolishing a room: the vault is saved without it and half of what it cost is paid back, in one step (the loot is kept to 99 of each kind).
create or replace function public.vault_demolish(p_user uuid, p_state jsonb, p_refund jsonb, p_version integer, p_key text default 'home') returns jsonb
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
  for k in select jsonb_object_keys(p_refund) loop
    insert into player_loot (user_id, loot, qty) values (p_user, k, least(99, greatest(0, (p_refund ->> k)::integer)))
      on conflict (user_id, loot) do update set qty = least(99, player_loot.qty + greatest(0, (p_refund ->> k)::integer));
  end loop;
  v := coalesce(have, 0) + 1;
  insert into home_vault (user_id, vault_key, state, version) values (p_user, p_key, p_state, v)
    on conflict (user_id, vault_key) do update set state = excluded.state, version = excluded.version, updated_at = now();
  return jsonb_build_object('ok', true, 'version', v);
end $$;
revoke all on function public.vault_demolish(uuid, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.vault_demolish(uuid, jsonb, jsonb, integer, text) to service_role;
