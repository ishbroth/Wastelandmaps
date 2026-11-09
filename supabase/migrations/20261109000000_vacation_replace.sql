-- Changing a vacation vault's place: the new place takes over the old one's vault (its rooms and furniture move with it), and the old place stops being a vacation vault.
-- The new one is paid for and made like any other (see vacation-vault); this only lets the count ignore the one being replaced, and moves the vault when it is done.

drop function if exists public.vacation_claim(uuid, text, text, text, double precision, double precision);
create function public.vacation_claim(p_user uuid, p_place text, p_name text, p_icon text, p_lat double precision, p_lng double precision, p_replace text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  existing record;
  mine integer;
begin
  select * into existing from vacation_vault where user_id = p_user and place_id = p_place for update;
  if found then
    if existing.status = 'ready' then return 'have'; end if;
    if existing.status = 'generating' and existing.started_at > now() - interval '150 seconds' then return 'busy'; end if;
    update vacation_vault set status = 'generating', started_at = now(), name = p_name, icon = p_icon, lat = p_lat, lng = p_lng where user_id = p_user and place_id = p_place;
    return 'ok';
  end if;
  select count(*) into mine from vacation_vault where user_id = p_user and status in ('ready', 'generating') and (p_replace is null or place_id <> p_replace);
  if mine >= 4 then return 'full'; end if;
  insert into vacation_vault (user_id, place_id, name, icon, lat, lng) values (p_user, p_place, p_name, p_icon, p_lat, p_lng);
  return 'ok';
end $$;
revoke all on function public.vacation_claim(uuid, text, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.vacation_claim(uuid, text, text, text, double precision, double precision, text) to service_role;

-- The vault of the old place moves to the new one, and the old place is no longer a vacation vault.
create or replace function public.vacation_move(p_user uuid, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from home_vault where user_id = p_user and vault_key = p_new;
  update home_vault set vault_key = p_new where user_id = p_user and vault_key = p_old;
  delete from vacation_vault where user_id = p_user and place_id = p_old;
end $$;
revoke all on function public.vacation_move(uuid, text, text) from public, anon, authenticated;
grant execute on function public.vacation_move(uuid, text, text) to service_role;
