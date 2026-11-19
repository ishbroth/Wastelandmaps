-- TEMPORARY TESTING RULE (to be removed later): the App Store review/test account, welpcustomer@yahoo.com, gets 500,000 caps (5,000 credits) automatically when its vault number is
-- set to 1234 (that is, when it registers its vault with the passcode 1234). It happens once per account: deleting the account and registering again makes a new account, which gets it again.
-- Only that email, and only that number. To remove the rule: drop trigger review_account_caps on public.user_home; drop function public.review_account_caps();
create or replace function public.review_account_caps() returns trigger
language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  if new.vault_number is distinct from 1234 then return new; end if;
  select email into mail from auth.users where id = new.user_id;
  if lower(coalesce(mail, '')) = 'welpcustomer@yahoo.com' then
    perform public.add_credits(new.user_id, 5000, 'review-account-caps:' || new.user_id::text); -- the marker makes it once per account
  end if;
  return new;
end $$;
drop trigger if exists review_account_caps on public.user_home;
create trigger review_account_caps after insert or update of vault_number on public.user_home for each row execute function public.review_account_caps();
