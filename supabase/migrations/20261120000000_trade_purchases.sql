-- The stimpak and Legendary Time trades: each of the three offers on the board can be bought once, then it is spent until the board changes (every four hours).
create table if not exists public.trade_purchases (
  user_id uuid not null references auth.users (id) on delete cascade,
  item text not null,
  trade_id text not null,
  window_no bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item, trade_id, window_no)
);
alter table public.trade_purchases enable row level security;
create policy "own trade purchases" on public.trade_purchases for select to authenticated using (user_id = auth.uid());
