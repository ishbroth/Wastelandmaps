-- Sign-ups that were never confirmed (the emailed link was never opened) stay in the sign-in service's user list forever unless something removes them. Every night at 03:15 UTC this deletes the
-- ones older than 7 days. It only ever touches an account that was never confirmed AND never signed in, so a real account (or one with any activity) cannot be caught by it.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.delete_unconfirmed_accounts() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from auth.users where email_confirmed_at is null and last_sign_in_at is null and created_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.delete_unconfirmed_accounts() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'delete-unconfirmed-accounts';
select cron.schedule('delete-unconfirmed-accounts', '15 3 * * *', $$select public.delete_unconfirmed_accounts()$$);
