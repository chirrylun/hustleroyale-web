-- Equipment: catalogue, owned gear, equipped slots; buy / sell / equip with class and level gating enforced here.
-- Ranks: 1 Rookie, 2 Soldier, 3 Knight, 4 Runed. Level to equip: 1 / 15 / 30 / 45 (edit gear_rank_level to rebalance).

create table if not exists public.equipment_templates (
  slug text primary key,
  name text not null,
  slot text not null check (slot in ('weapon','offhand','armor')),
  kind text not null,                       -- dagger sword mace staff shield broadshield armor
  rank smallint not null check (rank between 1 and 4),
  min_level integer not null,
  classes text[] not null,                  -- gear class ids allowed to equip it (see gear_class)
  atk integer not null default 0, def integer not null default 0, magic integer not null default 0,
  hp integer not null default 0, spd integer not null default 0,
  buy_price integer not null, sell_price integer not null, sort integer not null
);
create table if not exists public.player_gear (
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_slug text not null references public.equipment_templates(slug),
  qty integer not null check (qty > 0),
  primary key (owner_id, item_slug)
);
create table if not exists public.fighter_gear (
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  slot text not null check (slot in ('weapon','offhand','armor')),
  item_slug text not null references public.equipment_templates(slug),
  primary key (fighter_id, slot)
);
alter table public.equipment_templates enable row level security;
alter table public.player_gear enable row level security;
alter table public.fighter_gear enable row level security;
create policy equipment_templates_read on public.equipment_templates for select using (true);
create policy player_gear_read_own on public.player_gear for select using (owner_id = auth.uid());
create policy fighter_gear_read_own on public.fighter_gear for select using (exists (select 1 from public.fighters f where f.id = fighter_id and f.owner_id = auth.uid()));
revoke all on public.equipment_templates, public.player_gear, public.fighter_gear from anon, authenticated;
grant select on public.equipment_templates, public.player_gear, public.fighter_gear to authenticated;

-- A fighter's gear class: the current archetypes map onto the new class tree (warrior, thief, ...); new ids map to themselves.
create or replace function public.gear_class(a text) returns text language sql immutable set search_path = '' as $$
  select case a
    when 'recruit_fighter' then 'fighter' when 'recruit_acolyte' then 'healer' when 'recruit_thief' then 'rogue'
    when 'shield_tank' then 'warrior' when 'fighter_tank' then 'warrior' when 'debuff_tank' then 'warrior'
    when 'healer_tank' then 'pure_healer' when 'bard' then 'pure_healer' when 'healer_fighter' then 'battle_medic'
    when 'rogue' then 'thief' when 'magical_dps' then 'blackmage'
    else a end
$$;
create or replace function public.gear_rank_level(r integer) returns integer language sql immutable set search_path = '' as $$
  select (array[1, 15, 30, 45])[r]
$$;

-- Catalogue. Stats grow with rank; prices are rank price x kind factor, sell = 40%.
insert into public.equipment_templates (slug, name, slot, kind, rank, min_level, classes, atk, def, magic, hp, spd, buy_price, sell_price, sort)
select k.kind || '_' || r.rank, r.name || ' ' || k.label, k.slot, k.kind, r.rank, public.gear_rank_level(r.rank), k.classes,
       round(k.atk * r.mult), round(k.def * r.mult), round(k.magic * r.mult), round(k.hp * r.mult), round(k.spd * r.mult),
       round(r.price * k.price / 10.0) * 10, round(r.price * k.price * 0.4 / 10.0) * 10, k.ord * 10 + r.rank
from (values (1, 'Rookie', 1.0, 150), (2, 'Soldier', 3.0, 600), (3, 'Knight', 6.0, 2400), (4, 'Runed', 11.0, 9000)) r(rank, name, mult, price)
cross join (values
  ('dagger',     'Dagger',     'weapon',  2, 0, 0, 0, 1, 0.6, 1, array['novice','rogue','thief','ninja','samurai','ranger','archer','marksman','sharpshooter']),
  ('sword',      'Sword',      'weapon',  3, 0, 0, 0, 0, 1.0, 2, array['novice','fighter','soldier','warrior','paladin','samurai']),
  ('mace',       'Mace',       'weapon',  3, 0, 1, 0, 0, 1.0, 3, array['novice','fighter','soldier','warrior','paladin','healer','battle_medic','pure_healer']),
  ('staff',      'Long Staff', 'weapon',  1, 0, 3, 0, 0, 1.1, 4, array['novice','mage','necromancer','blackmage','whitemage','healer','battle_medic','pure_healer']),
  ('shield',     'Shield',     'offhand', 0, 2, 0, 5, 0, 0.8, 5, array['novice','fighter','soldier','warrior','paladin','battle_medic']),
  ('broadshield','Broadshield','offhand', 0, 3, 0, 10, 0, 1.2, 6, array['fighter','soldier','warrior','paladin'])
) k(kind, label, slot, atk, def, magic, hp, spd, price, ord, classes)
on conflict (slug) do nothing;

-- One full armor set per class and rank.
insert into public.equipment_templates (slug, name, slot, kind, rank, min_level, classes, atk, def, magic, hp, spd, buy_price, sell_price, sort)
select 'armor_' || c.id || '_' || r.rank, r.name || ' ' || c.label || ' Armor', 'armor', 'armor', r.rank, public.gear_rank_level(r.rank), array[c.id],
       0, round(c.def * r.mult), round(c.magic * r.mult), round(c.hp * r.mult), round(c.spd * r.mult),
       round(r.price * 1.5 / 10.0) * 10, round(r.price * 1.5 * 0.4 / 10.0) * 10, 100 + c.ord * 10 + r.rank
from (values (1, 'Rookie', 1.0, 150), (2, 'Soldier', 3.0, 600), (3, 'Knight', 6.0, 2400), (4, 'Runed', 11.0, 9000)) r(rank, name, mult, price)
cross join (values
  ('fighter','Fighter',2,0,12,0,1), ('soldier','Soldier',2,0,12,0,2), ('warrior','Warrior',3,0,16,0,3), ('paladin','Paladin',3,1,14,0,4),
  ('rogue','Rogue',1,0,8,1,5), ('thief','Thief',1,0,8,1,6), ('ninja','Ninja',1,0,7,2,7), ('samurai','Samurai',2,0,10,1,8),
  ('healer','Healer',1,1,9,0,9), ('battle_medic','Battle Medic',2,1,11,0,10), ('pure_healer','Pure Healer',1,2,8,0,11),
  ('mage','Mage',1,2,7,0,12), ('necromancer','Necromancer',1,2,7,0,13), ('blackmage','Blackmage',1,3,7,0,14), ('whitemage','Whitemage',1,2,8,0,15),
  ('ranger','Ranger',1,0,8,1,16), ('archer','Archer',1,0,8,1,17), ('marksman','Marksman',1,0,8,1,18), ('sharpshooter','Sharpshooter',1,0,7,1,19)
) c(id, label, def, magic, hp, spd, ord)
on conflict (slug) do nothing;

-- Owned gear minus what fighters are wearing = what can be sold or equipped.
create or replace function public.gear_free(p_owner uuid, p_slug text) returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select qty from public.player_gear where owner_id = p_owner and item_slug = p_slug), 0)
       - (select count(*)::int from public.fighter_gear g join public.fighters f on f.id = g.fighter_id where f.owner_id = p_owner and g.item_slug = p_slug)
$$;

create or replace function public.gear_buy(p_slug text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); price integer; left_coins bigint;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select buy_price into price from public.equipment_templates where slug = p_slug;
  if price is null then raise exception 'not_for_sale'; end if;
  update public.profiles set coins = coins - price where id = uid and coins >= price returning coins into left_coins;
  if left_coins is null then raise exception 'not_enough_coins'; end if;
  insert into public.player_gear (owner_id, item_slug, qty) values (uid, p_slug, 1)
    on conflict (owner_id, item_slug) do update set qty = public.player_gear.qty + 1;
  return jsonb_build_object('coins', left_coins);
end $$;

create or replace function public.gear_sell(p_slug text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); price integer; left_coins bigint;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select sell_price into price from public.equipment_templates where slug = p_slug;
  if price is null then raise exception 'not_for_sale'; end if;
  if public.gear_free(uid, p_slug) < 1 then raise exception 'not_enough_items'; end if; -- worn gear can't be sold
  delete from public.player_gear where owner_id = uid and item_slug = p_slug and qty <= 1;
  if not found then update public.player_gear set qty = qty - 1 where owner_id = uid and item_slug = p_slug; end if;
  update public.profiles set coins = coins + price where id = uid returning coins into left_coins;
  return jsonb_build_object('coins', left_coins);
end $$;

-- Equip an item on a fighter (replacing what is in that slot), checking class and level. p_slug null with p_slot = unequip.
create or replace function public.gear_equip(p_fighter uuid, p_slug text, p_slot text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f record; it record; gc text;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select fi.id, fi.level, t.archetype::text as archetype into f from public.fighters fi join public.fighter_templates t on t.id = fi.template_id where fi.id = p_fighter and fi.owner_id = uid;
  if f.id is null then raise exception 'not_your_fighter'; end if;
  if p_slug is null then
    if p_slot not in ('weapon','offhand','armor') then raise exception 'bad_slot'; end if;
    delete from public.fighter_gear where fighter_id = p_fighter and slot = p_slot;
    return jsonb_build_object('ok', true);
  end if;
  select * into it from public.equipment_templates where slug = p_slug;
  if it.slug is null then raise exception 'unknown_item'; end if;
  gc := public.gear_class(f.archetype);
  if not (gc = any (it.classes)) then raise exception 'wrong_class'; end if;
  if f.level < it.min_level then raise exception 'level_too_low'; end if;
  -- this fighter's own copy in the slot doesn't count against the free total
  if public.gear_free(uid, p_slug) < 1 and not exists (select 1 from public.fighter_gear where fighter_id = p_fighter and slot = it.slot and item_slug = p_slug) then raise exception 'not_enough_items'; end if;
  insert into public.fighter_gear (fighter_id, slot, item_slug) values (p_fighter, it.slot, p_slug)
    on conflict (fighter_id, slot) do update set item_slug = excluded.item_slug;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.gear_buy(text), public.gear_sell(text), public.gear_equip(uuid, text, text), public.gear_free(uuid, text) from public, anon;
grant execute on function public.gear_buy(text), public.gear_sell(text), public.gear_equip(uuid, text, text) to authenticated;
