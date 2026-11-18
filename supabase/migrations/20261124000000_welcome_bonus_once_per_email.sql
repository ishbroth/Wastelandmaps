-- The welcome gift (500 caps) is once per EMAIL, not once per account: deleting an account and registering again with the same email (or the same email with a "+tag", or a gmail address
-- with dots moved) does not pay it out again. The record keeps only a hash of the normalized email, and it has no link to the account, so deleting the account does not erase it.
create table if not exists public.welcome_bonus_emails (
  email_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.welcome_bonus_emails enable row level security; -- no policies: only the server touches it

create or replace function public.welcome_email_hash(p_email text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(
    case when split_part(lower(trim(p_email)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1) || '@' || split_part(lower(trim(p_email)), '@', 2)
    end, 'UTF8')), 'hex')
$$;

-- everyone who already got the gift is on the list
insert into public.welcome_bonus_emails (email_hash)
select public.welcome_email_hash(u.email) from public.welcome_bonus b join auth.users u on u.id = b.user_id where u.email is not null
on conflict do nothing;

-- Has this person (or this email, from an account deleted before) had the gift?
create or replace function public.welcome_bonus_taken(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from welcome_bonus where user_id = p_user)
      or exists (select 1 from auth.users u join welcome_bonus_emails e on e.email_hash = public.welcome_email_hash(u.email) where u.id = p_user)
$$;

create or replace function public.grant_welcome_bonus(p_user uuid, p_amount integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  select email into mail from auth.users where id = p_user;
  if mail is null then return false; end if;
  insert into welcome_bonus_emails (email_hash) values (public.welcome_email_hash(mail)) on conflict do nothing;
  if not found then
    insert into welcome_bonus (user_id) values (p_user) on conflict do nothing; -- (so this account reads as "already had it")
    return false;
  end if;
  insert into welcome_bonus (user_id) values (p_user) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason) values (p_user, p_amount, 'bonus');
  insert into credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = credits.balance + p_amount, updated_at = now();
  return true;
end $$;
revoke all on function public.grant_welcome_bonus(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_welcome_bonus(uuid, integer) to service_role;
revoke all on function public.welcome_bonus_taken(uuid) from public, anon, authenticated;
grant execute on function public.welcome_bonus_taken(uuid) to service_role;
