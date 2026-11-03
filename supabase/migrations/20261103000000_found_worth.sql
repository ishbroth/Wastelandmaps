-- What a place was worth when it was found (it decides the enemies and loot there), so the Data tab can list them.
alter table public.found_places add column if not exists worth int;
