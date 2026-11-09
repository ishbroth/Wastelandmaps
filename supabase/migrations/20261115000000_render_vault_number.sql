-- A place that is the entrance to a vault has the vault door in its picture. The render remembers which vault number it was made for (none for an ordinary
-- place), so a picture made before the place became a vault (or after it stopped being one) is made again, once.
alter table public.renders add column if not exists vault_number integer;
