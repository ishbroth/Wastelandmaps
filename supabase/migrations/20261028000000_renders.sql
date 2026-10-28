-- Paid game-style renders: credits, what each person has unlocked, and the renders themselves.
--
-- A person buys credits (a pack of 8 for $1.99). Unlocking one place's render costs one credit, once; after that they can see it again for free.
-- The first person to unlock a place causes the render to be generated and stored; everyone after that is shown the stored image (and pays
-- their own credit). Nothing here is readable or writable by the browser except a person's own balance and unlock list.

create table public.credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('purchase', 'unlock', 'refund')),
  -- a purchase is recorded once per Stripe checkout session, so a repeated webhook can never add credits twice
  stripe_session_id text unique,
  place_id text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user on public.credit_ledger (user_id, created_at desc);

create table public.unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.renders (
  place_id text primary key,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  place_name text,
  photo_title text,
  photo_author text,
  photo_license text,
  photo_page text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index renders_created on public.renders (created_at);

alter table public.credits enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.unlocks enable row level security;
alter table public.renders enable row level security;

create policy "own balance" on public.credits for select to authenticated using (user_id = auth.uid());
create policy "own ledger" on public.credit_ledger for select to authenticated using (user_id = auth.uid());
create policy "own unlocks" on public.unlocks for select to authenticated using (user_id = auth.uid());
-- renders has no policies: only the server (service role) reads and writes it, and hands out short-lived links to people who unlocked

-- The stored images. Private: a link only exists for someone who has unlocked the place.
insert into storage.buckets (id, name, public) values ('renders', 'renders', false) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Money movements. Only the server may call these.
-- ---------------------------------------------------------------------------

-- A purchase: adds credits, once per checkout session. Returns true if credits were added, false if this session was already counted.
create function public.add_credits(p_user uuid, p_amount integer, p_session text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into credit_ledger (user_id, delta, reason, stripe_session_id) values (p_user, p_amount, 'purchase', p_session)
    on conflict (stripe_session_id) do nothing;
  if not found then return false; end if;
  insert into credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = credits.balance + p_amount, updated_at = now();
  return true;
end $$;

-- Unlocking a place: 'already' (nothing charged), 'spent' (one credit charged), or 'no_credits'.
create function public.unlock_place(p_user uuid, p_place text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from unlocks where user_id = p_user and place_id = p_place) then return 'already'; end if;
  update credits set balance = balance - 1, updated_at = now() where user_id = p_user and balance >= 1;
  if not found then return 'no_credits'; end if;
  insert into unlocks (user_id, place_id) values (p_user, p_place) on conflict do nothing;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, -1, 'unlock', p_place);
  return 'spent';
end $$;

-- The render could not be made: take the unlock back and give the credit back.
create function public.refund_unlock(p_user uuid, p_place text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from unlocks where user_id = p_user and place_id = p_place;
  if not found then return; end if;
  update credits set balance = balance + 1, updated_at = now() where user_id = p_user;
  insert into credit_ledger (user_id, delta, reason, place_id) values (p_user, 1, 'refund', p_place);
end $$;

revoke all on function public.add_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.unlock_place(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_unlock(uuid, text) from public, anon, authenticated;
grant execute on function public.add_credits(uuid, integer, text) to service_role;
grant execute on function public.unlock_place(uuid, text) to service_role;
grant execute on function public.refund_unlock(uuid, text) to service_role;
