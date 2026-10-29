-- Walking to places (GPS auto-discover) earns snapshot credits: every 10 places discovered is one free credit, at most 2 free credits a day.
-- The place list is the person's own record; the server counts each place once per person.

alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check check (reason in ('purchase', 'unlock', 'refund', 'bonus'));

create table public.discoveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.discoveries enable row level security;
create policy "own discoveries" on public.discoveries for select to authenticated using (user_id = auth.uid());

-- Records one discovery. Returns { total, bonus, given }: how many places this person has discovered, and whether a free credit was just earned.
create function public.record_discovery(p_user uuid, p_place text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  earned integer;
  today integer;
  give integer := 0;
begin
  insert into discoveries (user_id, place_id) values (p_user, p_place) on conflict do nothing;
  if not found then
    select count(*) into n from discoveries where user_id = p_user;
    return jsonb_build_object('total', n, 'bonus', false, 'given', 0);
  end if;
  select count(*) into n from discoveries where user_id = p_user;
  select coalesce(sum(delta), 0) into earned from credit_ledger where user_id = p_user and reason = 'bonus';
  select coalesce(sum(delta), 0) into today from credit_ledger where user_id = p_user and reason = 'bonus' and created_at > now() - interval '1 day';
  give := greatest(0, least(n / 10 - earned, 2 - today));
  if give > 0 then
    insert into credit_ledger (user_id, delta, reason) values (p_user, give, 'bonus');
    insert into credits (user_id, balance) values (p_user, give)
      on conflict (user_id) do update set balance = credits.balance + give, updated_at = now();
  end if;
  return jsonb_build_object('total', n, 'bonus', give > 0, 'given', give);
end $$;

revoke all on function public.record_discovery(uuid, text) from public, anon, authenticated;
grant execute on function public.record_discovery(uuid, text) to service_role;
