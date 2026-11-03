-- Which metro was on the map when a raid started, so a survivor's progress toward clearing each metro can be listed. (It is for the list only: the bonus itself is checked against the
-- metro's own list of places and the survivor's won raids.)
alter table public.raid_runs add column if not exists metro_id text;
