-- Where each signed-in person last left the map, so it opens there next time (on any device).
create table public.map_positions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  zoom double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.map_positions enable row level security;
create policy "own position, read" on public.map_positions for select to authenticated using (user_id = auth.uid());
create policy "own position, add" on public.map_positions for insert to authenticated with check (user_id = auth.uid());
create policy "own position, update" on public.map_positions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
