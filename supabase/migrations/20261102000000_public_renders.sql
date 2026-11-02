-- The renders of public places and addresses are part of the public atlas: kept in a bucket anyone can read, so they can have pages of their own.
-- (A person's home render, which carries their vault number, stays in the private bucket.)
insert into storage.buckets (id, name, public) values ('public-renders', 'public-renders', true) on conflict (id) do update set public = true;
