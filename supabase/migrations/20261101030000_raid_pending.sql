-- A permanent landmark fought from afar pays its loot only once the survivor has discovered it: the run is kept as won but not yet paid.
alter table public.raid_runs add column if not exists paid boolean not null default true;
