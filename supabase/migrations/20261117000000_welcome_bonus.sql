-- 500 free caps (5 credits) for each person, once, the first time they are signed in from the phone app (the server checks the request came from the app).
create table if not exists public.welcome_bonus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.welcome_bonus enable row level security;
create policy "own welcome bonus" on public.welcome_bonus for select to authenticated using (user_id = auth.uid());

create or replace function public.grant_welcome_bonus(p_user uuid, p_amount integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into welcome_bonus (user_id) values (p_user) on conflict do nothing;
  if not found then return false; end if;
  insert into credit_ledger (user_id, delta, reason) values (p_user, p_amount, 'bonus');
  insert into credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = credits.balance + p_amount, updated_at = now();
  return true;
end $$;
revoke all on function public.grant_welcome_bonus(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_welcome_bonus(uuid, integer) to service_role;
