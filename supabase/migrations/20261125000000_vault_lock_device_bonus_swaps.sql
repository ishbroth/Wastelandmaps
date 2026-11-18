-- 1. Five wrong vault-number tries lock a vault until its owner resets the number by email (see the vault-sign-in function).
create table if not exists public.vault_login_attempts (
  email_hash text primary key,
  fails integer not null default 0,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.vault_login_attempts enable row level security; -- no policies: only the server touches it

create or replace function public.vault_login_hash(p_email text) returns text
language sql immutable as $$ select encode(sha256(convert_to(lower(trim(p_email)), 'UTF8')), 'hex') $$;

-- Counts a try BEFORE it is checked (one locked step, so parallel guesses cannot slip past the limit). allowed = false when the vault is locked.
create or replace function public.vault_login_try(p_email text, p_max integer default 5) returns table (allowed boolean, fails integer, locked boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare h text := public.vault_login_hash(p_email); r record; nf integer;
begin
  insert into vault_login_attempts (email_hash) values (h) on conflict do nothing;
  select * into r from vault_login_attempts where email_hash = h for update;
  if r.locked_at is not null then return query select false, r.fails, true; return; end if;
  update vault_login_attempts set fails = r.fails + 1, locked_at = case when r.fails + 1 >= p_max then now() else null end, updated_at = now()
    where email_hash = h returning fails into nf;
  return query select true, nf, false;
end $$;

create or replace function public.vault_login_reset(p_email text) returns void
language sql security definer set search_path = public as $$ delete from vault_login_attempts where email_hash = public.vault_login_hash(p_email) $$;

create or replace function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$ select id from auth.users where lower(email) = lower(trim(p_email)) limit 1 $$;

-- 2. The welcome gift is also once per device (the app sends an id that survives a reinstall); only a hash of it is kept, with no link to the account.
create table if not exists public.welcome_bonus_devices (
  device_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.welcome_bonus_devices enable row level security;

drop function if exists public.grant_welcome_bonus(uuid, integer);
create or replace function public.grant_welcome_bonus(p_user uuid, p_amount integer, p_device text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare mail text; dh text;
begin
  if p_device is null then return false; end if;
  select email into mail from auth.users where id = p_user;
  if mail is null then return false; end if;
  dh := encode(sha256(convert_to(p_device, 'UTF8')), 'hex');
  -- a device that has had the gift gets no second one; neither does an email that has had it
  if exists (select 1 from welcome_bonus_devices where device_hash = dh)
     or exists (select 1 from welcome_bonus_emails where email_hash = public.welcome_email_hash(mail)) then
    insert into welcome_bonus (user_id) values (p_user) on conflict do nothing; -- (this account reads as "already had it")
    return false;
  end if;
  insert into welcome_bonus_devices (device_hash) values (dh) on conflict do nothing;
  insert into welcome_bonus_emails (email_hash) values (public.welcome_email_hash(mail)) on conflict do nothing;
  insert into welcome_bonus (user_id) values (p_user) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason) values (p_user, p_amount, 'bonus');
  insert into credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = credits.balance + p_amount, updated_at = now();
  return true;
end $$;
revoke all on function public.grant_welcome_bonus(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.grant_welcome_bonus(uuid, integer, text) to service_role;

-- 3. The first time an account clears its home vault: 5 extra pieces of loot, once per email (a new address later, or a deleted and re-made account, gets none).
create table if not exists public.home_clear_bonus (
  email_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.home_clear_bonus enable row level security;
create or replace function public.claim_home_clear_bonus(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  select email into mail from auth.users where id = p_user;
  if mail is null then return false; end if;
  insert into home_clear_bonus (email_hash) values (public.welcome_email_hash(mail)) on conflict do nothing;
  return found;
end $$;
revoke all on function public.claim_home_clear_bonus(uuid) from public, anon, authenticated;
grant execute on function public.claim_home_clear_bonus(uuid) to service_role;

-- 4. Redrawing the number on a home picture costs the server image-model calls: at most p_max redraws per person per day.
create table if not exists public.vault_swaps (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.vault_swaps enable row level security;
create or replace function public.vault_swap_slot(p_user uuid, p_max integer default 3) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from vault_swaps where at < now() - interval '2 days';
  if (select count(*) from vault_swaps where user_id = p_user and at > now() - interval '1 day') >= p_max then return false; end if;
  insert into vault_swaps (user_id) values (p_user);
  return true;
end $$;
revoke all on function public.vault_swap_slot(uuid, integer) from public, anon, authenticated;
grant execute on function public.vault_swap_slot(uuid, integer) to service_role;
revoke all on function public.vault_login_try(text, integer), public.vault_login_reset(text), public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.vault_login_try(text, integer), public.vault_login_reset(text), public.user_id_by_email(text) to service_role;
