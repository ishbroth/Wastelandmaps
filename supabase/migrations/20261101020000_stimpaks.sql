-- Stimpaks: made from spare loot, used in the shooting gallery to take back the three strikes. Only the server changes the count.
create table if not exists public.player_stimpaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  qty integer not null default 0 check (qty >= 0)
);
alter table public.player_stimpaks enable row level security;
drop policy if exists "own stimpaks" on public.player_stimpaks;
create policy "own stimpaks" on public.player_stimpaks for select to authenticated using (user_id = auth.uid());

-- Trades loot for one stimpak: the whole cost ({"wood": 3, ...}) comes out at once or not at all. Returns { ok, qty } or { ok: false, reason }.
create or replace function public.trade_stimpak(p_user uuid, p_cost jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  have integer;
begin
  select qty into have from player_stimpaks where user_id = p_user;
  if coalesce(have, 0) >= 99 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  for k in select jsonb_object_keys(p_cost) loop
    if coalesce((select qty from player_loot where user_id = p_user and loot = k), 0) < (p_cost ->> k)::integer then
      return jsonb_build_object('ok', false, 'reason', 'loot');
    end if;
  end loop;
  for k in select jsonb_object_keys(p_cost) loop
    update player_loot set qty = qty - (p_cost ->> k)::integer where user_id = p_user and loot = k;
  end loop;
  insert into player_stimpaks (user_id, qty) values (p_user, 1)
    on conflict (user_id) do update set qty = player_stimpaks.qty + 1
    returning qty into have;
  return jsonb_build_object('ok', true, 'qty', have);
end $$;

-- Uses one stimpak. Returns { ok, qty } or { ok: false, reason: 'none' }.
create or replace function public.use_stimpak(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  left_over integer;
begin
  update player_stimpaks set qty = qty - 1 where user_id = p_user and qty > 0 returning qty into left_over;
  if not found then return jsonb_build_object('ok', false, 'reason', 'none'); end if;
  return jsonb_build_object('ok', true, 'qty', left_over);
end $$;

revoke all on function public.trade_stimpak(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.use_stimpak(uuid) from public, anon, authenticated;
grant execute on function public.trade_stimpak(uuid, jsonb) to service_role;
grant execute on function public.use_stimpak(uuid) to service_role;
