-- Fiber optics is concrete now: the same loot in the same place on every list, with a new name. The kind is changed wherever it is kept.
alter table public.player_loot drop constraint if exists player_loot_loot_check;
update public.player_loot set loot = 'concrete' where loot = 'fiberoptics';
alter table public.player_loot add constraint player_loot_loot_check check (loot in ('steel', 'wood', 'springs', 'adhesive', 'screws', 'concrete', 'glass', 'circuitry', 'oil', 'gears', 'plastic'));
-- loot waiting at cleared places, and what raids were to pay
update public.raid_runs set loot = (loot - 'fiberoptics') || jsonb_build_object('concrete', loot -> 'fiberoptics') where loot ? 'fiberoptics';
