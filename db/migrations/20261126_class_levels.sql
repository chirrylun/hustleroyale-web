-- Each class has a level, shown as a tag in the class changer (and now enforced).
--   tier 1 (taken from Recruit)      Lv 20  = rank 2, the same level choose_class already asks
--   tier 2 (grows out of a tier 1)   Lv 35  = rank 3
--   tier 3 (grows out of a tier 2)   Lv 50  = rank 4
-- Change a class's level with: update public.class_tree set min_level = N where archetype = '...';
alter table public.class_tree add column if not exists min_level integer not null default 1;
update public.class_tree set min_level = case tier when 1 then public.rank_level_req('uncommon') when 2 then public.rank_level_req('rare') else public.rank_level_req('legendary') end;

create or replace function public.class_changer(p_fighter uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare f record; cur record;
begin
  select fi.* into f from public.fighters fi where fi.id = p_fighter and fi.owner_id = auth.uid();
  if not found then raise exception 'not_your_fighter'; end if;
  select * into cur from public.fighter_templates where id = f.template_id;
  return jsonb_build_object('archetype', cur.archetype, 'role', cur.role, 'fee', public.class_change_fee(f.level),
    'ready', cur.archetype::text in (select archetype from public.class_tree),
    'options', coalesce((select jsonb_agg(jsonb_build_object('archetype', c.archetype, 'tier', c.tier, 'requires', c.requires, 'min_level', c.min_level,
        'owned', exists (select 1 from public.fighter_class_history h where h.fighter_id = p_fighter and h.archetype = c.archetype),
        'unlocked', c.requires is null or exists (select 1 from public.fighter_class_history h where h.fighter_id = p_fighter and h.archetype = c.requires),
        'current', c.archetype = cur.archetype::text) order by c.tier, c.archetype)
      from public.class_tree c where c.role = cur.role::text), '[]'::jsonb));
end $function$;

-- change_class: the same as before, plus the level check.
create or replace function public.change_class(p_fighter uuid, p_archetype text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); f record; cur record; c record; tgt uuid; v_fee int; v_left bigint; k record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select fi.* into f from public.fighters fi where fi.id = p_fighter and fi.owner_id = uid for update;
  if not found then raise exception 'not_your_fighter'; end if;
  select * into cur from public.fighter_templates where id = f.template_id;
  if cur.archetype::text not in (select archetype from public.class_tree) then raise exception 'choose_class_first'; end if;
  select * into c from public.class_tree where archetype = p_archetype;
  if not found or c.role <> cur.role::text then raise exception 'class_not_available'; end if;
  if c.archetype = cur.archetype::text then raise exception 'already_has_class'; end if;
  if c.requires is not null and not exists (select 1 from public.fighter_class_history where fighter_id = p_fighter and archetype = c.requires) then raise exception 'class_locked'; end if;
  if f.level < c.min_level then raise exception 'level_too_low'; end if;
  select id into tgt from public.fighter_templates where archetype::text = p_archetype and rarity = cur.rarity and role = cur.role;
  if tgt is null then raise exception 'class_not_available'; end if;

  v_fee := public.class_change_fee(f.level);
  update public.profiles set coins = coins - v_fee where id = uid and coins >= v_fee returning coins into v_left;
  if not found then raise exception 'not_enough_coins'; end if;
  insert into public.coin_ledger (user_id, amount, balance_after, reason) values (uid, -v_fee, v_left, 'class_change');

  delete from public.fighter_gear where fighter_id = p_fighter;      -- weapons and armour go back to the bag
  perform public.swap_template(p_fighter, tgt);
  if (select rarity from public.fighter_templates where id = tgt) <> 'common' then
    update public.fighters set skill_points = greatest(0, skill_points - 1) where id = p_fighter; -- changing class never earns points
  end if;
  delete from public.fighter_skills where fighter_id = p_fighter and slot > 1;
  select id into tgt from public.fighter_templates where archetype::text = p_archetype and rarity = 'common' and role = cur.role;
  for k in select skill_id from public.fighter_template_skills where template_id = tgt and slot > 1 order by slot loop
    insert into public.fighter_learned (fighter_id, skill_id) values (p_fighter, k.skill_id) on conflict do nothing;
    perform public._auto_equip(p_fighter, k.skill_id);
  end loop;
  insert into public.fighter_class_history (fighter_id, archetype) values (p_fighter, p_archetype) on conflict do nothing;
  return jsonb_build_object('ok', true, 'fee', v_fee, 'coins', v_left);
end $function$;
