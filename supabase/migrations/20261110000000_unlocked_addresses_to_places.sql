-- Addresses whose snapshot was paid for before they were visited were never saved as the person's own places (only reaching them did that), so they
-- were missing from the map. Save them now: the icon matches what kind of place each one is.
insert into public.personal_places (user_id, place_id, name, address, lat, lng, kind)
select u.user_id, a.place_id, left(a.name, 80), a.address, a.lat, a.lng, a.kind
from public.unlocks u
join public.address_renders a on a.place_id = substr(u.place_id, 4)
where u.place_id like 'me:%' and char_length(a.name) >= 1
on conflict (user_id, place_id) do nothing;
