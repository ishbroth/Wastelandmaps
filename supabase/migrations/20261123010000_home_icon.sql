-- The icon drawn inside the home vault's cog when the home is a recognizable kind of building (a pre-plotted place, or an address that is not an ordinary house).
alter table public.user_home add column if not exists home_icon text;
