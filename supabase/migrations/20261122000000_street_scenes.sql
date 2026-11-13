-- Our own street view keeps what it works out about a neighbourhood so the next person who walks there starts from it: the shape of the streets in each square of about
-- 250 metres (from OpenStreetMap), saved once and reused. Nothing private is in it, only the streets.
create table if not exists public.street_scenes (
  cell text primary key,
  roads jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.street_scenes enable row level security; -- no policies: only the server reads and writes it
