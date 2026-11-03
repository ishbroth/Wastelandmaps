-- Clearing a metro: when a survivor has looted every place in a metro that counts (see _tools/build-clearable.mjs), the metro is marked cleared for them and they are paid 4 credits
-- (400 caps), once. The metro-clear function checks the claim against their won raids; only the server writes here.
create table if not exists public.metro_clears (
  user_id uuid not null references auth.users (id) on delete cascade,
  metro_id text not null,
  cleared_at timestamptz not null default now(),
  primary key (user_id, metro_id)
);
alter table public.metro_clears enable row level security;
drop policy if exists "own metro clears" on public.metro_clears;
create policy "own metro clears" on public.metro_clears for select to authenticated using (user_id = auth.uid());

-- the bonus has its own reason, so it does not count as a level bonus in record_discovery's sums
alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check check (reason in ('purchase', 'unlock', 'refund', 'bonus', 'metro_clear'));

-- Marks the metro cleared and pays, once. Returns 'awarded' or 'already'.
create or replace function public.award_metro_clear(p_user uuid, p_metro text, p_credits integer) returns text
language plpgsql security definer set search_path = public as $$
begin
  insert into metro_clears (user_id, metro_id) values (p_user, p_metro) on conflict do nothing;
  if not found then return 'already'; end if;
  insert into credits (user_id, balance) values (p_user, p_credits)
    on conflict (user_id) do update set balance = credits.balance + p_credits, updated_at = now();
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, p_credits, 'metro_clear', 'metro:' || p_metro);
  return 'awarded';
end $$;
revoke all on function public.award_metro_clear(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.award_metro_clear(uuid, text, integer) to service_role;
