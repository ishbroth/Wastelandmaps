-- Personal places: an address a person has travelled to (found by searching for it and fast travelling there). They are the person's own pins, on their own
-- map, and can be renamed. Each has a street-level snapshot that costs 4 credits (it costs more to make than a landmark's: a Street View picture is fetched
-- and the render is made just for them, never shared).

create table public.personal_places (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  name text not null check (char_length(name) between 1 and 80),
  address text not null,
  lat double precision not null,
  lng double precision not null,
  kind text not null check (kind in ('house', 'park', 'office', 'church', 'medical', 'gov')),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.personal_places enable row level security;
create policy "own personal places: read" on public.personal_places for select to authenticated using (user_id = auth.uid());
create policy "own personal places: add" on public.personal_places for insert to authenticated with check (user_id = auth.uid());
create policy "own personal places: rename" on public.personal_places for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own personal places: remove" on public.personal_places for delete to authenticated using (user_id = auth.uid());

-- the street snapshots: made by the server, shown only to their owner (no policies: only the server reads and writes it)
create table public.personal_renders (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.personal_renders enable row level security;

-- Unlocking costs `p_cost` credits at once: 'already' (nothing charged), 'spent', or 'no_credits'.
create function public.unlock_personal(p_user uuid, p_place text, p_cost integer) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from unlocks where user_id = p_user and place_id = p_place) then return 'already'; end if;
  update credits set balance = balance - p_cost, updated_at = now() where user_id = p_user and balance >= p_cost;
  if not found then return 'no_credits'; end if;
  insert into unlocks (user_id, place_id) values (p_user, p_place) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, -p_cost, 'unlock', p_place);
  return 'spent';
end $$;

-- The snapshot could not be made: take the unlock back and give the credits back.
create function public.refund_personal(p_user uuid, p_place text, p_cost integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from unlocks where user_id = p_user and place_id = p_place;
  if not found then return; end if;
  update credits set balance = balance + p_cost, updated_at = now() where user_id = p_user;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, p_cost, 'refund', p_place);
end $$;

revoke all on function public.unlock_personal(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.refund_personal(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.unlock_personal(uuid, text, integer) to service_role;
grant execute on function public.refund_personal(uuid, text, integer) to service_role;
