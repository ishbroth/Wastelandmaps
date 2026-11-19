-- A home vault is now discovered the same way as any place: by being there (or by choosing it while standing there). Homes that already exist stay discovered, so nothing
-- turns hollow or loses its ENTER button because of the new rule. No XP is given for them (points 0).
insert into public.discoveries (user_id, place_id, points)
select h.user_id, 'me:' || h.place_id, 0 from public.user_home h where h.place_id is not null
on conflict do nothing;

insert into public.found_places (user_id, place_id, name, metro_id, lat, lng)
select h.user_id, 'me:' || h.place_id, 'VAULT ' || lpad(h.vault_number::text, 4, '0'), h.home_metro, h.lat, h.lng
from public.user_home h where h.place_id is not null and h.vault_number is not null and h.lat is not null and h.lng is not null
on conflict do nothing;
