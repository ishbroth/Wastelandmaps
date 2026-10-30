-- Points and levels. A place reached on foot is worth points (landmarks with a permanent snapshot 75, other world-famous ones 50, government
-- buildings, museums and skyscrapers 30, ... everything else 10). Level 1 is 80 points (eight of the least valuable places); each level after that
-- asks for 5% more than the one before. Every level reached gives a free snapshot credit (at most 2 a day; the rest follow on the next discovery).

alter table public.discoveries add column if not exists points integer not null default 10;

drop function if exists public.record_discovery(uuid, text);

create or replace function public.record_discovery(p_user uuid, p_place text, p_points integer default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  pts bigint;
  lvl integer;
  earned integer;
  today integer;
  give integer := 0;
  worth integer := greatest(1, least(coalesce(p_points, 10), 100));
begin
  insert into discoveries (user_id, place_id, points) values (p_user, p_place, worth) on conflict do nothing;
  if not found then
    select count(*), coalesce(sum(points), 0) into n, pts from discoveries where user_id = p_user;
    return jsonb_build_object('total', n, 'points', pts, 'level', floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9), 'added', 0, 'bonus', false, 'given', 0);
  end if;
  select count(*), coalesce(sum(points), 0) into n, pts from discoveries where user_id = p_user;
  -- level L is reached at 1600 * (1.05^L - 1) points: 80, 164, 253, ...
  lvl := floor(ln(1 + pts / 1600.0) / ln(1.05) + 1e-9);
  select coalesce(sum(delta), 0) into earned from credit_ledger where user_id = p_user and reason = 'bonus';
  select coalesce(sum(delta), 0) into today from credit_ledger where user_id = p_user and reason = 'bonus' and created_at > now() - interval '1 day';
  give := greatest(0, least(lvl - earned, 2 - today));
  if give > 0 then
    insert into credit_ledger (user_id, delta, reason) values (p_user, give, 'bonus');
    insert into credits (user_id, balance) values (p_user, give)
      on conflict (user_id) do update set balance = credits.balance + give, updated_at = now();
  end if;
  return jsonb_build_object('total', n, 'points', pts, 'level', lvl, 'added', worth, 'bonus', give > 0, 'given', give);
end $$;

revoke all on function public.record_discovery(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_discovery(uuid, text, integer) to service_role;
