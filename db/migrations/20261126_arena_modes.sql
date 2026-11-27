-- Arena modes: the Boss Rush leaderboard. One best time per player, boss and level range, with the team that did it
-- (names, levels and looks), so other players can see what a winning team looks like. No rewards.
create table if not exists public.boss_rush_best (
  user_id uuid not null references public.profiles(id) on delete cascade,
  boss text not null check (boss in ('goblin', 'golem', 'mushroom', 'direwolf')),
  range text not null check (range in ('10-20', '20-30', '30-40')),
  time_ms integer not null check (time_ms > 0),
  team jsonb not null default '[]'::jsonb,
  achieved_at timestamptz not null default now(),
  primary key (user_id, boss, range)
);
create index if not exists boss_rush_best_board on public.boss_rush_best (boss, range, time_ms);
alter table public.boss_rush_best enable row level security;
-- Nobody reads or writes the table directly: the board goes through boss_rush_board, results through srv_record_boss_rush.

-- Called by the game server when a team beats a boss. Keeps the faster time. Returns the rank and whether it is a new best.
create or replace function public.srv_record_boss_rush(p_user uuid, p_boss text, p_range text, p_time_ms integer, p_team jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_prev integer; v_new boolean := false; v_rank integer;
begin
  select time_ms into v_prev from public.boss_rush_best where user_id = p_user and boss = p_boss and range = p_range;
  if v_prev is null or p_time_ms < v_prev then
    insert into public.boss_rush_best (user_id, boss, range, time_ms, team, achieved_at) values (p_user, p_boss, p_range, p_time_ms, p_team, now())
    on conflict (user_id, boss, range) do update set time_ms = excluded.time_ms, team = excluded.team, achieved_at = now();
    v_new := true;
  end if;
  select 1 + count(*) into v_rank from public.boss_rush_best b
    where b.boss = p_boss and b.range = p_range and b.time_ms < (select time_ms from public.boss_rush_best where user_id = p_user and boss = p_boss and range = p_range);
  return jsonb_build_object('new_best', v_new, 'best_ms', least(coalesce(v_prev, p_time_ms), p_time_ms), 'rank', v_rank);
end $$;
revoke all on function public.srv_record_boss_rush(uuid, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.srv_record_boss_rush(uuid, text, text, integer, jsonb) to service_role;

-- The board for one boss and range: fastest first, with each team's fighters. `you` marks the caller's own row.
create or replace function public.boss_rush_board(p_boss text, p_range text, p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(r order by (r->>'rank')::int), '[]'::jsonb) from (
    select jsonb_build_object('rank', row_number() over (order by b.time_ms, b.achieved_at), 'name', coalesce(p.username, 'Player'), 'time_ms', b.time_ms,
      'team', b.team, 'you', b.user_id = auth.uid(), 'at', b.achieved_at) r
    from public.boss_rush_best b join public.profiles p on p.id = b.user_id
    where b.boss = p_boss and b.range = p_range
    order by b.time_ms, b.achieved_at limit greatest(1, least(p_limit, 50))
  ) t;
$$;
revoke all on function public.boss_rush_board(text, text, integer) from public, anon;
grant execute on function public.boss_rush_board(text, text, integer) to authenticated;

-- The caller's own best on each boss and range (shown on the boss cards).
create or replace function public.boss_rush_mine()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('boss', boss, 'range', range, 'time_ms', time_ms)), '[]'::jsonb) from public.boss_rush_best where user_id = auth.uid();
$$;
revoke all on function public.boss_rush_mine() from public, anon;
grant execute on function public.boss_rush_mine() to authenticated;
