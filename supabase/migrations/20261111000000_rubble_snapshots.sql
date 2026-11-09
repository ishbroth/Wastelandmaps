-- A place that cannot be shown as it was (its property is blurred out on Street View, or there is no street picture) is rendered as rubble only. The render is
-- shared like every address render, and marked so the next person to unlock it pays just the one credit it is worth.
alter table public.address_renders add column if not exists rubble boolean not null default false;

-- Pay some of the price back without taking the unlock away (the rubble is unlocked and kept; only the extra credits return).
create or replace function public.part_refund_personal(p_user uuid, p_place text, p_refund integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from unlocks where user_id = p_user and place_id = p_place) then return; end if;
  update credits set balance = balance + p_refund, updated_at = now() where user_id = p_user;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, p_refund, 'refund', p_place);
end $$;
revoke all on function public.part_refund_personal(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.part_refund_personal(uuid, text, integer) to service_role;
