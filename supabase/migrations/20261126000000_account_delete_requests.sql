-- Deleting an account is confirmed by an emailed link: pressing the red button only records a request and sends the email; the account is deleted only when the link is opened
-- (the delete-account function checks that the person signed in through an emailed link AFTER the request). At most 3 emails per person in 12 hours.
create table if not exists public.account_delete_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  sends integer not null default 1,
  window_start timestamptz not null default now()
);
alter table public.account_delete_requests enable row level security; -- no policies: only the server touches it
