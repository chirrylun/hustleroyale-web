-- Training ground tutorial. After the arena fights a new player is led through a training field:
--   0 manager intro -> 1 talk to the Trainer -> 2 quest 1 (kill a monster) -> 3 quest 2 (all three fighters to level 5)
--   -> 4 quest 3 (put a potion in a shortcut slot) -> 5 quest 4 (every fighter becomes a Recruit) -> 6 back to the manager -> 100 done.
-- Existing players who have finished the old tutorial are marked done (100).

alter table public.profiles add column if not exists training_step smallint not null default 100;
alter table public.profiles add column if not exists training_kills integer not null default 0;
alter table public.profiles add column if not exists training_potion boolean not null default false;
alter table public.profiles add column if not exists tips_seen text[] not null default '{}';
update public.profiles set training_step = case when tutorial_step >= 6 then 100 else 0 end;
alter table public.profiles alter column training_step set default 0;

-- A Novice can become a Recruit from level 5 (was 10).
create or replace function public.rank_level_req(p_rank public.rarity) returns integer language sql immutable set search_path = '' as $$
  select case p_rank when 'common' then 5 when 'uncommon' then 20 when 'rare' then 35 else 50 end $$;

-- Kill payout in the training field (service role, called by the game server). Slimes of level 1-3 only. Experience is
-- worked out so that three Novices reach level 5 after about a dozen kills together, and stops at level 5 so it can't be farmed.
create or replace function public.srv_report_training_kill(p_user uuid, p_kind text, p_level integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p record; r record; g jsonb; v_n integer; v_tokens numeric; v_awards jsonb := '[]'::jsonb;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'unauthorized'; end if;
  if p_kind <> 'slime' or p_level < 1 or p_level > 3 then raise exception 'bad_monster'; end if;
  v_tokens := least(15, coalesce(p.kill_tokens, 15) + extract(epoch from (now() - coalesce(p.kill_tokens_at, now()))) / 5.0);
  if v_tokens < 1 then
    update public.profiles set kill_tokens = v_tokens, kill_tokens_at = now() where id = p.id;
    return jsonb_build_object('xp', 0, 'fighters', 0, 'awards', '[]'::jsonb, 'drops', '[]'::jsonb, 'quests', '[]'::jsonb, 'throttled', true);
  end if;
  update public.profiles set kill_tokens = v_tokens - 1, kill_tokens_at = now(), training_kills = training_kills + 1 where id = p.id;
  select count(*) into v_n from public.fighters where owner_id = p.id and team_slot > 0;
  for r in select id, level from public.fighters where owner_id = p.id and team_slot > 0 loop
    if r.level < 5 then
      g := public.award_xp(r.id, 62, r.level, greatest(v_n, 1));
      v_awards := v_awards || jsonb_build_object('id', r.id, 'gained', g->'gained', 'level', g->'level', 'levels_gained', g->'levels_gained');
    end if;
  end loop;
  return jsonb_build_object('xp', coalesce((select max((a->>'gained')::int) from jsonb_array_elements(v_awards) a), 0),
    'fighters', v_n, 'awards', v_awards, 'drops', '[]'::jsonb, 'quests', '[]'::jsonb, 'throttled', false, 'training_kills', p.training_kills + 1);
end $$;
revoke all on function public.srv_report_training_kill(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.srv_report_training_kill(uuid, text, integer) to service_role;

-- Gives items to a player's bag (capped at 100 in total, like drops).
create or replace function public._give_item(p_user uuid, p_slug text, p_qty integer) returns void language plpgsql security definer set search_path = '' as $$
declare v_bag integer; v_q integer;
begin
  select coalesce(sum(qty), 0) into v_bag from public.player_items where owner_id = p_user;
  v_q := least(p_qty, greatest(0, 100 - v_bag));
  if v_q <= 0 then return; end if;
  insert into public.player_items (owner_id, item_slug, qty) values (p_user, p_slug, v_q)
    on conflict (owner_id, item_slug) do update set qty = public.player_items.qty + excluded.qty;
end $$;
revoke all on function public._give_item(uuid, text, integer) from public, anon, authenticated;

-- The shortcut-slot quest: the browser says a potion is in a slot; only players who own a potion can set it.
create or replace function public.training_flag_potion() returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if exists (select 1 from public.player_items where owner_id = uid and qty > 0 and item_slug like '%potion%') then
    update public.profiles set training_potion = true where id = uid and training_step between 4 and 5;
  end if;
end $$;
revoke all on function public.training_flag_potion() from public, anon;
grant execute on function public.training_flag_potion() to authenticated;

-- Moves the player one step along the tutorial and pays what that step earns. The step's own conditions are checked here.
create or replace function public.training_advance() returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p record; f record; v_id uuid; v_base text; v_coins integer := 0; v_xp integer := 0; v_items jsonb := '[]'::jsonb; v_armor jsonb := '[]'::jsonb; v_next integer;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'unauthorized'; end if;
  v_next := p.training_step + 1;
  case p.training_step
    when 0 then null;
    when 1 then null;
    when 2 then
      if p.training_kills < 1 then raise exception 'training_not_ready'; end if;
      v_coins := 100; v_xp := 53;
    when 3 then
      if exists (select 1 from public.fighters where owner_id = uid and team_slot > 0 and level < 5) then raise exception 'training_not_ready'; end if;
      v_coins := 250; v_xp := 106;
      perform public._give_item(uid, 'hp_potion', 5); perform public._give_item(uid, 'hp_potion_m', 5);
      perform public._give_item(uid, 'mp_potion', 5); perform public._give_item(uid, 'mp_potion_m', 5);
      v_items := '[{"slug":"hp_potion","qty":5},{"slug":"hp_potion_m","qty":5},{"slug":"mp_potion","qty":5},{"slug":"mp_potion_m","qty":5}]'::jsonb;
    when 4 then
      if not p.training_potion then raise exception 'training_not_ready'; end if;
    when 5 then
      if exists (select 1 from public.fighters fi join public.fighter_templates t on t.id = fi.template_id where fi.owner_id = uid and fi.team_slot > 0 and t.archetype = 'novice')
         or not exists (select 1 from public.fighters where owner_id = uid and team_slot > 0) then raise exception 'training_not_ready'; end if;
      for f in select fi.id, t.archetype::text as arch, fi.level from public.fighters fi join public.fighter_templates t on t.id = fi.template_id where fi.owner_id = uid and fi.team_slot > 0 loop
        v_base := 'armor_' || public.gear_class(f.arch);
        if exists (select 1 from public.equipment_bases where slug = v_base) then
          insert into public.gear_items (owner_id, base_slug, rank, level) values (uid, v_base, 1, 1) returning id into v_id;
          perform public.gear_refresh(v_id);
          insert into public.fighter_gear (fighter_id, slot, item_id) values (f.id, 'armor', v_id) on conflict (fighter_id, slot) do nothing;
          v_armor := v_armor || jsonb_build_object('fighter', f.id, 'base', v_base);
        end if;
      end loop;
    when 6 then v_next := 100;
    else return jsonb_build_object('step', p.training_step);
  end case;
  if v_coins > 0 then update public.profiles set coins = coins + v_coins where id = uid; end if;
  if v_xp > 0 then
    for f in select id, level from public.fighters where owner_id = uid and team_slot > 0 loop
      perform public.award_xp(f.id, v_xp, f.level, greatest(1, (select count(*) from public.fighters where owner_id = uid and team_slot > 0))::int);
    end loop;
  end if;
  update public.profiles set training_step = v_next where id = uid;
  return jsonb_build_object('step', v_next, 'coins', v_coins, 'xp', v_xp, 'items', v_items, 'armor', v_armor);
end $$;
revoke all on function public.training_advance() from public, anon;
grant execute on function public.training_advance() to authenticated;

-- One-time tips ("first time you open the party screen", "first wipe"): remembered per player.
create or replace function public.tip_seen(p_key text) returns void language sql security definer set search_path = '' as $$
  update public.profiles set tips_seen = array_append(tips_seen, left(p_key, 40))
  where id = auth.uid() and not (left(p_key, 40) = any (tips_seen)) and cardinality(tips_seen) < 40 $$;
revoke all on function public.tip_seen(text) from public, anon;
grant execute on function public.tip_seen(text) to authenticated;
