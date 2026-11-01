-- A home vault number may start with a zero (0000 to 9999); it is always shown with four digits, so 0730 is not Vault 730.
alter table public.user_home drop constraint if exists user_home_vault_number_range;
alter table public.user_home add constraint user_home_vault_number_range check (vault_number is null or (vault_number between 0 and 9999));
