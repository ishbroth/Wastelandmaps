-- No two survivors can share a callsign, whatever the capital letters.
create unique index if not exists leaderboard_names_callsign_ci on public.leaderboard_names (lower(callsign));
