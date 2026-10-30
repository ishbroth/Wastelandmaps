-- Looting: a survivor raids a place whose snapshot they have unlocked (a shooting gallery against whatever lives there now); winning pays loot, and loot
-- builds guns. The server starts and ends every raid and is the only thing that adds loot or sets a gun's tier, so the browser cannot hand itself either.

create table public.player_loot (
  user_id uuid not null references auth.users (id) on delete cascade,
  loot text not null check (loot in ('steel', 'wood', 'springs', 'adhesive', 'screws', 'fiberoptics', 'glass', 'circuitry', 'oil', 'gears', 'plastic')),
  qty integer not null default 0 check (qty >= 0),
  primary key (user_id, loot)
);

-- the highest tier reached in each class; a person with no row has the tier 1 pistol and nothing else
create table public.player_weapons (
  user_id uuid not null references auth.users (id) on delete cascade,
  weapon_class text not null check (weapon_class in ('pistol', 'automatic', 'sniper', 'explosive')),
  tier integer not null check (tier between 1 and 4),
  primary key (user_id, weapon_class)
);

-- one row per raid: started by the server with the loot it will pay already decided, finished by the server
create table public.raid_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  worth integer not null,
  enemies integer not null,
  loot jsonb not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  won boolean
);
create index raid_runs_user on public.raid_runs (user_id, started_at desc);

alter table public.player_loot enable row level security;
alter table public.player_weapons enable row level security;
alter table public.raid_runs enable row level security;
create policy "own loot" on public.player_loot for select to authenticated using (user_id = auth.uid());
create policy "own weapons" on public.player_weapons for select to authenticated using (user_id = auth.uid());
create policy "own raids" on public.raid_runs for select to authenticated using (user_id = auth.uid());

-- Adds loot ({"steel": 2, "gears": 1}) to a person's inventory.
create function public.grant_loot(p_user uuid, p_loot jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
begin
  for k in select jsonb_object_keys(p_loot) loop
    insert into player_loot (user_id, loot, qty) values (p_user, k, greatest(0, (p_loot ->> k)::integer))
      on conflict (user_id, loot) do update set qty = player_loot.qty + greatest(0, (p_loot ->> k)::integer);
  end loop;
end $$;

-- Builds or upgrades a gun: the new tier must be the very next one, and the whole cost ({"steel": 3, ...}) comes out of the inventory at once or not at all.
-- Returns { ok, tier } or { ok: false, reason }.
create function public.craft_weapon(p_user uuid, p_class text, p_tier integer, p_cost jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  have integer;
  k text;
begin
  select coalesce(max(tier), case when p_class = 'pistol' then 1 else 0 end) into have from player_weapons where user_id = p_user and weapon_class = p_class;
  if p_class = 'pistol' and have < 1 then have := 1; end if;
  if p_tier <> have + 1 then
    return jsonb_build_object('ok', false, 'reason', 'tier');
  end if;
  for k in select jsonb_object_keys(p_cost) loop
    if coalesce((select qty from player_loot where user_id = p_user and loot = k), 0) < (p_cost ->> k)::integer then
      return jsonb_build_object('ok', false, 'reason', 'loot');
    end if;
  end loop;
  for k in select jsonb_object_keys(p_cost) loop
    update player_loot set qty = qty - (p_cost ->> k)::integer where user_id = p_user and loot = k;
  end loop;
  insert into player_weapons (user_id, weapon_class, tier) values (p_user, p_class, p_tier)
    on conflict (user_id, weapon_class) do update set tier = excluded.tier;
  return jsonb_build_object('ok', true, 'tier', p_tier);
end $$;

revoke all on function public.grant_loot(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.craft_weapon(uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.grant_loot(uuid, jsonb) to service_role;
grant execute on function public.craft_weapon(uuid, text, integer, jsonb) to service_role;
