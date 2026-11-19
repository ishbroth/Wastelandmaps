-- If someone deletes their account while the welcome gift (500 caps) is still completely untouched, the gift is given back: the email and the device are released, so a new account can have it again.
-- Untouched means exactly one entry in the caps ledger (the gift itself) and the balance still exactly that. Any caps spent, any pack bought, any caps earned or refunded, and it stays used up.
-- To release the device, the device record has to remember which account got the gift; it is cleared again when the account goes (the record then stays, with no link to anyone).
alter table public.welcome_bonus_devices add column if not exists granted_to uuid;

create or replace function public.grant_welcome_bonus(p_user uuid, p_amount integer, p_device text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare mail text; dh text;
begin
  if p_device is null then return false; end if;
  select email into mail from auth.users where id = p_user;
  if mail is null then return false; end if;
  dh := encode(sha256(convert_to(p_device, 'UTF8')), 'hex');
  if exists (select 1 from welcome_bonus_devices where device_hash = dh)
     or exists (select 1 from welcome_bonus_emails where email_hash = public.welcome_email_hash(mail)) then
    insert into welcome_bonus (user_id) values (p_user) on conflict do nothing;
    return false;
  end if;
  insert into welcome_bonus_devices (device_hash, granted_to) values (dh, p_user) on conflict do nothing;
  insert into welcome_bonus_emails (email_hash) values (public.welcome_email_hash(mail)) on conflict do nothing;
  insert into welcome_bonus (user_id) values (p_user) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason) values (p_user, p_amount, 'bonus');
  insert into credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = credits.balance + p_amount, updated_at = now();
  return true;
end $$;
revoke all on function public.grant_welcome_bonus(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.grant_welcome_bonus(uuid, integer, text) to service_role;

-- Called by delete-account just before the account is removed. True when the gift was untouched and has been released.
create or replace function public.release_welcome_bonus_if_untouched(p_user uuid, p_amount integer default 5) returns boolean
language plpgsql security definer set search_path = public as $$
declare mail text; untouched boolean;
begin
  select email into mail from auth.users where id = p_user;
  untouched := (select count(*) from credit_ledger where user_id = p_user) = 1
    and exists (select 1 from credit_ledger where user_id = p_user and reason = 'bonus' and delta = p_amount)
    and coalesce((select balance from credits where user_id = p_user), 0) = p_amount;
  if untouched and mail is not null then
    delete from welcome_bonus_emails where email_hash = public.welcome_email_hash(mail);
    delete from welcome_bonus_devices where granted_to = p_user;
  else
    update welcome_bonus_devices set granted_to = null where granted_to = p_user; -- the record stays, with no link to the account
  end if;
  return untouched;
end $$;
revoke all on function public.release_welcome_bonus_if_untouched(uuid, integer) from public, anon, authenticated;
grant execute on function public.release_welcome_bonus_if_untouched(uuid, integer) to service_role;
