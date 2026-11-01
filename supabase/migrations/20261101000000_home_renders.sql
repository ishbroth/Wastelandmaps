-- Blowing up your own home: the render carries that person's own vault number on a vault door, so it is theirs alone (never shared like address_renders).
create table if not exists public.home_renders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_id text not null,
  vault_number integer not null,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- no policies: only the server reads or writes it
alter table public.home_renders enable row level security;
