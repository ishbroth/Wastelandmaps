-- The admin account: always has every kind of loot at 99 and a full purse of caps, whatever is spent. A trigger puts the numbers back as they are written,
-- so spending (unlocks, crafting, trades, the shooter) never lowers them.
create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admin_accounts enable row level security; -- no policies: only the server and this script touch it

insert into public.admin_accounts (user_id)
select id from auth.users where lower(email) = 'iw@sdcarealty.com'
on conflict do nothing;

create or replace function public.admin_keep_credits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from admin_accounts where user_id = new.user_id) then new.balance := 9999; end if; -- 9,999 credits = 999,900 caps
  return new;
end $$;
drop trigger if exists admin_keep_credits on public.credits;
create trigger admin_keep_credits before insert or update on public.credits for each row execute function public.admin_keep_credits();

create or replace function public.admin_keep_loot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from admin_accounts where user_id = new.user_id) then new.qty := 99; end if;
  return new;
end $$;
drop trigger if exists admin_keep_loot on public.player_loot;
create trigger admin_keep_loot before insert or update on public.player_loot for each row execute function public.admin_keep_loot();

-- now
insert into public.credits (user_id, balance) select user_id, 9999 from public.admin_accounts
on conflict (user_id) do update set balance = 9999, updated_at = now();
insert into public.player_loot (user_id, loot, qty)
select a.user_id, l, 99 from public.admin_accounts a, unnest(array['steel', 'wood', 'springs', 'adhesive', 'screws', 'fiberoptics', 'glass', 'circuitry', 'oil', 'gears', 'plastic']) as l
on conflict (user_id, loot) do update set qty = 99;
