-- Stimpaks can be bought several at a time, and there is a second thing to buy with spare loot: Legendary Time, which slows the enemies in the shooting gallery for four
-- seconds. Only the server changes the counts. The old one-at-a-time trade_stimpak is left where it is, so the function that is live today keeps working until it is redeployed.

create table if not exists public.player_time (
  user_id uuid primary key references auth.users (id) on delete cascade,
  qty integer not null default 0 check (qty >= 0)
);
alter table public.player_time enable row level security;
drop policy if exists "own time" on public.player_time;
create policy "own time" on public.player_time for select to authenticated using (user_id = auth.uid());

-- Buys p_qty of an item ('stimpak' or 'time') for p_qty times the cost ({"wood": 3, ...}): all of the loot comes out at once or not at all, and a person holds at most 99
-- of an item. Returns { ok, qty } (how many they have now) or { ok: false, reason: 'loot' | 'full' | 'bad_item' }.
create or replace function public.trade_item(p_user uuid, p_item text, p_cost jsonb, p_qty integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  have integer;
  owned integer;
  q integer := greatest(1, least(coalesce(p_qty, 1), 99));
begin
  if p_item not in ('stimpak', 'time') then
    return jsonb_build_object('ok', false, 'reason', 'bad_item');
  end if;
  if p_item = 'stimpak' then
    select qty into have from player_stimpaks where user_id = p_user;
  else
    select qty into have from player_time where user_id = p_user;
  end if;
  if coalesce(have, 0) + q > 99 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  for k in select jsonb_object_keys(p_cost) loop
    select qty into owned from player_loot where user_id = p_user and loot = k for update;
    if coalesce(owned, 0) < (p_cost ->> k)::integer * q then
      return jsonb_build_object('ok', false, 'reason', 'loot');
    end if;
  end loop;
  for k in select jsonb_object_keys(p_cost) loop
    update player_loot set qty = qty - (p_cost ->> k)::integer * q where user_id = p_user and loot = k;
  end loop;
  if p_item = 'stimpak' then
    insert into player_stimpaks (user_id, qty) values (p_user, q)
      on conflict (user_id) do update set qty = player_stimpaks.qty + q
      returning qty into have;
  else
    insert into player_time (user_id, qty) values (p_user, q)
      on conflict (user_id) do update set qty = player_time.qty + q
      returning qty into have;
  end if;
  return jsonb_build_object('ok', true, 'qty', have);
end $$;

-- Uses one Legendary Time. Returns { ok, qty } or { ok: false, reason: 'none' }.
create or replace function public.use_time(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  left_over integer;
begin
  update player_time set qty = qty - 1 where user_id = p_user and qty > 0 returning qty into left_over;
  if left_over is null then
    return jsonb_build_object('ok', false, 'reason', 'none');
  end if;
  return jsonb_build_object('ok', true, 'qty', left_over);
end $$;

revoke all on function public.trade_item(uuid, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.use_time(uuid) from public, anon, authenticated;
grant execute on function public.trade_item(uuid, text, jsonb, integer) to service_role;
grant execute on function public.use_time(uuid) to service_role;
