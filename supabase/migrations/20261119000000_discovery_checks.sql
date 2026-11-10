-- Where each person was the last time they reported a discovery, and when: so a report that could not have been reached in the time (faster than a plane) is refused.
create table if not exists public.discovery_checks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  at timestamptz not null default now()
);
-- no policies: only the server reads or writes it
alter table public.discovery_checks enable row level security;
