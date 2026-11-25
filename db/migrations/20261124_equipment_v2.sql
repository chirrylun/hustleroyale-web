-- Equipment v2 (replaces 20261121_equipment.sql): every piece is its own item with a rank 1-4 and a level 1-10.
--   Enhance: level +1, up to 10.   Evolve: at level 10 the item goes up a rank and drops back to level 1 (its look changes). Rank 4 level 10 is the top.
-- The shop sells rank 1 only. Stats are stored on the item (refreshed whenever rank or level changes) so battles read plain columns.
-- Level to wear: rank 1 = 1, rank 2 = 15, rank 3 = 30, rank 4 = 45 (gear_rank_level).

create temp table _old_inv as select owner_id, item_slug, qty from public.player_gear;
create temp table _old_worn as select fighter_id, slot, item_slug from public.fighter_gear;
drop table public.fighter_gear; drop table public.player_gear; drop table public.equipment_templates;
drop function if exists public.gear_buy(text), public.gear_sell(text), public.gear_equip(uuid, text, text), public.gear_free(uuid, text);

create table public.equipment_bases (
  slug text primary key, name text not null,
  slot text not null check (slot in ('weapon','offhand','armor')),
  kind text not null,                -- dagger sword mace staff shield broadshield bow armor
  classes text[] not null,           -- gear class ids allowed to equip it (gear_class)
  atk integer not null default 0, def integer not null default 0, magic integer not null default 0, hp integer not null default 0, spd integer not null default 0,
  base_price integer not null, sort integer not null
);
create table public.gear_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_slug text not null references public.equipment_bases(slug),
  rank smallint not null default 1 check (rank between 1 and 4),
  level smallint not null default 1 check (level between 1 and 10),
  atk integer not null default 0, def integer not null default 0, magic integer not null default 0, hp integer not null default 0, spd integer not null default 0,
  created_at timestamptz not null default now()
);
create index gear_items_owner on public.gear_items(owner_id);
create table public.fighter_gear (
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  slot text not null check (slot in ('weapon','offhand','armor')),
  item_id uuid not null unique references public.gear_items(id) on delete cascade,
  primary key (fighter_id, slot)
);
alter table public.equipment_bases enable row level security;
alter table public.gear_items enable row level security;
alter table public.fighter_gear enable row level security;
create policy equipment_bases_read on public.equipment_bases for select using (true);
create policy gear_items_read_own on public.gear_items for select using (owner_id = auth.uid());
create policy fighter_gear_read_own on public.fighter_gear for select using (exists (select 1 from public.fighters f where f.id = fighter_id and f.owner_id = auth.uid()));
revoke all on public.equipment_bases, public.gear_items, public.fighter_gear from anon, authenticated;
grant select on public.equipment_bases, public.gear_items, public.fighter_gear to authenticated;

create or replace function public.gear_class(a text) returns text language sql immutable set search_path = '' as $$
  select case a
    when 'recruit_fighter' then 'fighter' when 'recruit_acolyte' then 'healer' when 'recruit_thief' then 'rogue'
    when 'fighter_tank' then 'warrior' when 'debuff_tank' then 'warrior' when 'healer_tank' then 'warden'
    when 'healer_fighter' then 'battle_medic' when 'rogue' then 'thief' when 'magical_dps' then 'mage'
    else a end
$$;
create or replace function public.gear_rank_level(r integer) returns integer language sql immutable set search_path = '' as $$ select (array[1, 15, 30, 45])[r] $$;
create or replace function public.gear_stat(b integer, r integer, l integer) returns integer language sql immutable set search_path = '' as $$
  select round(b * (array[1, 2.2, 4.2, 7])[r] * (1 + 0.1 * (l - 1)))::integer $$;
-- coin value of a rank (what it costs to reach it, roughly): used for sell price and enhance / evolve costs
create or replace function public.gear_rank_value(r integer) returns integer language sql immutable set search_path = '' as $$ select (array[1, 4, 16, 60])[r] $$;

create or replace function public.gear_refresh(p_id uuid) returns void language sql security definer set search_path = '' as $$
  update public.gear_items g set atk = public.gear_stat(b.atk, g.rank, g.level), def = public.gear_stat(b.def, g.rank, g.level),
    magic = public.gear_stat(b.magic, g.rank, g.level), hp = public.gear_stat(b.hp, g.rank, g.level), spd = public.gear_stat(b.spd, g.rank, g.level)
  from public.equipment_bases b where b.slug = g.base_slug and g.id = p_id $$;
revoke all on function public.gear_refresh(uuid) from public, anon, authenticated;

-- Catalogue
insert into public.equipment_bases (slug, name, slot, kind, classes, atk, def, magic, hp, spd, base_price, sort) values
 ('dagger','Dagger','weapon','dagger', array['novice','rogue','thief','ninja','samurai','ranger','archer','marksman','sharpshooter','bard'], 2,0,0,0,1, 90, 1),
 ('sword','Sword','weapon','sword', array['novice','fighter','soldier','warrior','warden','paladin','shield_tank','samurai'], 3,0,0,0,0, 150, 2),
 ('mace','Mace','weapon','mace', array['novice','fighter','soldier','warrior','warden','paladin','shield_tank','healer','battle_medic','pure_healer','bard'], 3,0,1,0,0, 150, 3),
 ('staff','Long Staff','weapon','staff', array['novice','mage','necromancer','blackmage','whitemage','healer','battle_medic','pure_healer','bard'], 1,0,3,0,0, 170, 4),
 ('shield','Shield','offhand','shield', array['novice','fighter','soldier','warrior','warden','paladin','shield_tank','battle_medic'], 0,2,0,5,0, 120, 5),
 ('broadshield','Broadshield','offhand','broadshield', array['fighter','soldier','warrior','warden','paladin','shield_tank'], 0,3,0,10,0, 180, 6);
insert into public.equipment_bases (slug, name, slot, kind, classes, def, magic, hp, spd, base_price, sort)
select 'armor_' || id, label || ' Armor', 'armor', 'armor', array[id], def, magic, hp, spd, 225, 100 + ord from (values
  ('fighter','Fighter',2,0,12,0,1), ('soldier','Soldier',2,0,12,0,2), ('warrior','Warrior',3,0,16,0,3), ('warden','Warden',3,1,15,0,4), ('paladin','Paladin',3,1,14,0,5), ('shield_tank','Shield Tank',4,0,18,0,6),
  ('rogue','Rogue',1,0,8,1,7), ('thief','Thief',1,0,8,1,8), ('ninja','Ninja',1,0,7,2,9), ('samurai','Samurai',2,0,10,1,10),
  ('healer','Healer',1,1,9,0,11), ('battle_medic','Battle Medic',2,1,11,0,12), ('pure_healer','Pure Healer',1,2,8,0,13), ('bard','Bard',1,1,8,1,14),
  ('mage','Mage',1,2,7,0,15), ('necromancer','Necromancer',1,2,7,0,16), ('blackmage','Blackmage',1,3,7,0,17), ('whitemage','Whitemage',1,2,8,0,18),
  ('ranger','Ranger',1,0,8,1,19), ('archer','Archer',1,0,8,1,20), ('marksman','Marksman',1,0,8,1,21), ('sharpshooter','Sharpshooter',1,0,7,1,22)
) c(id, label, def, magic, hp, spd, ord);

-- Carry over what players already own (old slugs were <base>_<rank>).
insert into public.gear_items (owner_id, base_slug, rank)
select i.owner_id, regexp_replace(i.item_slug, '_[0-9]$', ''), right(i.item_slug, 1)::smallint from _old_inv i, generate_series(1, 1) where regexp_replace(i.item_slug, '_[0-9]$', '') in (select slug from public.equipment_bases);
select public.gear_refresh(id) from public.gear_items;
insert into public.fighter_gear (fighter_id, slot, item_id)
select w.fighter_id, w.slot, (select g.id from public.gear_items g join public.fighters f on f.owner_id = g.owner_id where f.id = w.fighter_id and g.base_slug = regexp_replace(w.item_slug, '_[0-9]$', '') limit 1)
from _old_worn w where exists (select 1 from public.gear_items g join public.fighters f on f.owner_id = g.owner_id where f.id = w.fighter_id and g.base_slug = regexp_replace(w.item_slug, '_[0-9]$', ''));

create or replace function public.gear_buy(p_base text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); price integer; left_coins bigint; nid uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select base_price into price from public.equipment_bases where slug = p_base;
  if price is null then raise exception 'not_for_sale'; end if;
  update public.profiles set coins = coins - price where id = uid and coins >= price returning coins into left_coins;
  if left_coins is null then raise exception 'not_enough_coins'; end if;
  insert into public.gear_items (owner_id, base_slug) values (uid, p_base) returning id into nid;
  perform public.gear_refresh(nid);
  return jsonb_build_object('coins', left_coins, 'id', nid);
end $$;

create or replace function public.gear_sell(p_item uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it record; price integer; left_coins bigint;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select g.id, g.rank, g.level, b.base_price into it from public.gear_items g join public.equipment_bases b on b.slug = g.base_slug where g.id = p_item and g.owner_id = uid;
  if it.id is null then raise exception 'not_enough_items'; end if;
  if exists (select 1 from public.fighter_gear where item_id = p_item) then raise exception 'item_worn'; end if;
  price := round(it.base_price * public.gear_rank_value(it.rank) * (1 + 0.15 * (it.level - 1)) * 0.4);
  delete from public.gear_items where id = p_item;
  update public.profiles set coins = coins + price where id = uid returning coins into left_coins;
  return jsonb_build_object('coins', left_coins, 'price', price);
end $$;

create or replace function public.gear_equip(p_fighter uuid, p_item uuid, p_slot text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f record; it record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select fi.id, fi.level, t.archetype::text as archetype into f from public.fighters fi join public.fighter_templates t on t.id = fi.template_id where fi.id = p_fighter and fi.owner_id = uid;
  if f.id is null then raise exception 'not_your_fighter'; end if;
  if p_item is null then
    if p_slot not in ('weapon','offhand','armor') then raise exception 'bad_slot'; end if;
    delete from public.fighter_gear where fighter_id = p_fighter and slot = p_slot;
    return jsonb_build_object('ok', true);
  end if;
  select g.id, g.rank, b.slot, b.classes into it from public.gear_items g join public.equipment_bases b on b.slug = g.base_slug where g.id = p_item and g.owner_id = uid;
  if it.id is null then raise exception 'not_enough_items'; end if;
  if not (public.gear_class(f.archetype) = any (it.classes)) then raise exception 'wrong_class'; end if;
  if f.level < public.gear_rank_level(it.rank) then raise exception 'level_too_low'; end if;
  delete from public.fighter_gear where item_id = p_item;  -- moving it from another fighter
  insert into public.fighter_gear (fighter_id, slot, item_id) values (p_fighter, it.slot, p_item)
    on conflict (fighter_id, slot) do update set item_id = excluded.item_id;
  return jsonb_build_object('ok', true);
end $$;

-- Enhancer (the NPC comes later; these are the rules it will call). Costs are coins for now.
create or replace function public.gear_enhance_cost(p_base integer, p_rank integer, p_level integer) returns integer language sql immutable set search_path = '' as $$
  select ceil(p_base * public.gear_rank_value(p_rank) * 0.2 * p_level)::integer $$;
create or replace function public.gear_evolve_cost(p_base integer, p_rank integer) returns integer language sql immutable set search_path = '' as $$
  select ceil(p_base * public.gear_rank_value(p_rank + 1) * 0.5)::integer $$;

create or replace function public.gear_enhance(p_item uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it record; cost integer; left_coins bigint;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select g.id, g.rank, g.level, b.base_price into it from public.gear_items g join public.equipment_bases b on b.slug = g.base_slug where g.id = p_item and g.owner_id = uid;
  if it.id is null then raise exception 'not_enough_items'; end if;
  if it.level >= 10 then raise exception 'max_level'; end if;
  cost := public.gear_enhance_cost(it.base_price, it.rank, it.level);
  update public.profiles set coins = coins - cost where id = uid and coins >= cost returning coins into left_coins;
  if left_coins is null then raise exception 'not_enough_coins'; end if;
  update public.gear_items set level = level + 1 where id = p_item;
  perform public.gear_refresh(p_item);
  return jsonb_build_object('coins', left_coins, 'level', it.level + 1);
end $$;

create or replace function public.gear_evolve(p_item uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it record; cost integer; left_coins bigint; wearer record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select g.id, g.rank, g.level, b.base_price into it from public.gear_items g join public.equipment_bases b on b.slug = g.base_slug where g.id = p_item and g.owner_id = uid;
  if it.id is null then raise exception 'not_enough_items'; end if;
  if it.rank >= 4 then raise exception 'max_rank'; end if;
  if it.level < 10 then raise exception 'needs_level_10'; end if;
  select fi.level into wearer from public.fighter_gear fg join public.fighters fi on fi.id = fg.fighter_id where fg.item_id = p_item;
  if wearer.level is not null and wearer.level < public.gear_rank_level(it.rank + 1) then raise exception 'level_too_low'; end if;  -- keeps a worn item legal
  cost := public.gear_evolve_cost(it.base_price, it.rank);
  update public.profiles set coins = coins - cost where id = uid and coins >= cost returning coins into left_coins;
  if left_coins is null then raise exception 'not_enough_coins'; end if;
  update public.gear_items set rank = rank + 1, level = 1 where id = p_item;
  perform public.gear_refresh(p_item);
  return jsonb_build_object('coins', left_coins, 'rank', it.rank + 1);
end $$;

revoke all on function public.gear_buy(text), public.gear_sell(uuid), public.gear_equip(uuid, uuid, text), public.gear_enhance(uuid), public.gear_evolve(uuid) from public, anon;
grant execute on function public.gear_buy(text), public.gear_sell(uuid), public.gear_equip(uuid, uuid, text), public.gear_enhance(uuid), public.gear_evolve(uuid) to authenticated;
