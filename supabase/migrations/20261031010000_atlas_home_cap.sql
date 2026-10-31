-- 1. A home for each person (asked once, at first sign-in; skipping is remembered so they are not asked again).
-- 2. The address atlas: every address anyone unlocks a street snapshot for is kept, with its render, for everyone who unlocks that same address after.
--    One render per address; the first person pays for making it, everyone else pays the same 4 credits to unlock it. 48 credits unlock every rendered
--    address in a metro (including ones rendered later).
-- 3. Loot is capped at 99 of each kind; anything past the cap is lost, and the raid says how much.

create table public.user_home (
  user_id uuid primary key references auth.users (id) on delete cascade,
  place_id text,
  name text,
  address text,
  lat double precision,
  lng double precision,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.user_home enable row level security;
create policy "own home: read" on public.user_home for select to authenticated using (user_id = auth.uid());
create policy "own home: add" on public.user_home for insert to authenticated with check (user_id = auth.uid());
create policy "own home: change" on public.user_home for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- the per-person street renders from the first version are replaced by the shared atlas (nothing was stored in them yet)
drop table if exists public.personal_renders;

create table public.address_renders (
  place_id text primary key,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  kind text not null check (kind in ('house', 'park', 'office', 'church', 'medical', 'gov')),
  metro_id text,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index address_renders_metro on public.address_renders (metro_id) where status = 'ready';
-- no policies: only the server reads or writes it, and shows an address only to someone who has unlocked it
alter table public.address_renders enable row level security;

create table public.metro_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  metro_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, metro_id)
);
alter table public.metro_unlocks enable row level security;
create policy "own metro unlocks" on public.metro_unlocks for select to authenticated using (user_id = auth.uid());

-- Unlocking every rendered address in a metro: 'already', 'spent' or 'no_credits'.
create function public.unlock_metro(p_user uuid, p_metro text, p_cost integer) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from metro_unlocks where user_id = p_user and metro_id = p_metro) then return 'already'; end if;
  update credits set balance = balance - p_cost, updated_at = now() where user_id = p_user and balance >= p_cost;
  if not found then return 'no_credits'; end if;
  insert into metro_unlocks (user_id, metro_id) values (p_user, p_metro) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, -p_cost, 'unlock', 'metro:' || p_metro);
  return 'spent';
end $$;
revoke all on function public.unlock_metro(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.unlock_metro(uuid, text, integer) to service_role;

-- Loot: at most 99 of each kind. Returns { granted: {...}, lost: {...} }.
drop function if exists public.grant_loot(uuid, jsonb);
create function public.grant_loot(p_user uuid, p_loot jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  want integer;
  have integer;
  take integer;
  granted jsonb := '{}'::jsonb;
  lost jsonb := '{}'::jsonb;
begin
  for k in select jsonb_object_keys(p_loot) loop
    want := greatest(0, (p_loot ->> k)::integer);
    select coalesce(qty, 0) into have from player_loot where user_id = p_user and loot = k;
    have := coalesce(have, 0);
    take := least(want, greatest(0, 99 - have));
    if take > 0 then
      insert into player_loot (user_id, loot, qty) values (p_user, k, take)
        on conflict (user_id, loot) do update set qty = player_loot.qty + take;
      granted := granted || jsonb_build_object(k, take);
    end if;
    if want > take then lost := lost || jsonb_build_object(k, want - take); end if;
  end loop;
  return jsonb_build_object('granted', granted, 'lost', lost);
end $$;
revoke all on function public.grant_loot(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.grant_loot(uuid, jsonb) to service_role;
