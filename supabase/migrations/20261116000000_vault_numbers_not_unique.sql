-- A vault number is only the simple password for the person's own account (the account is the email); two people may have the same four digits.
drop index if exists public.user_home_vault_number_unique;
