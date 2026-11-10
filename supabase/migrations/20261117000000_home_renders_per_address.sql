-- A home picture (the destroyed building with the person's own vault door and number) is private to that person and kept for each address they have had as home,
-- so going back to an old address finds its picture again. Another survivor who makes the same address their home gets a picture of their own, with their number.
-- (These pictures are never part of the shared address cache or the metro atlas.)
alter table public.home_renders drop constraint if exists home_renders_pkey;
alter table public.home_renders add primary key (user_id, google_id);
