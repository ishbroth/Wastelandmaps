-- What a signed-in person has found (so it follows them to any device), and whether AUTO-DISCOVER was left on.

create table if not exists public.found_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  name text not null,
  old_name text,
  metro_id text,
  city text,
  state text,
  country text,
  lat double precision not null,
  lng double precision not null,
  found_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

alter table public.found_places enable row level security;

drop policy if exists "found places: read own" on public.found_places;
create policy "found places: read own" on public.found_places for select using (auth.uid() = user_id);
drop policy if exists "found places: add own" on public.found_places;
create policy "found places: add own" on public.found_places for insert with check (auth.uid() = user_id);

alter table public.map_positions add column if not exists auto_discover boolean not null default false;
-- the map position row may now be created by the auto-discover switch before the map has moved
alter table public.map_positions alter column lat drop not null;
alter table public.map_positions alter column lng drop not null;
alter table public.map_positions alter column zoom drop not null;
