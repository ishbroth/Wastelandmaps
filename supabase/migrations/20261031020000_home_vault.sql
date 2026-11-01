-- A person's home is a vault with a four-digit number they choose (1000 to 9999). It is the only kind of vault with four digits, and no two people share one.
alter table public.user_home add column if not exists vault_number integer;
alter table public.user_home drop constraint if exists user_home_vault_number_range;
alter table public.user_home add constraint user_home_vault_number_range check (vault_number is null or (vault_number between 1000 and 9999));
create unique index if not exists user_home_vault_number_unique on public.user_home (vault_number) where vault_number is not null;
