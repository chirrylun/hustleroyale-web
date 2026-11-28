-- Teleport Stone: use it to travel (guild, lobby, market, arena, or any unlocked floor), and sell it at the merchant.
-- (The alchemist already mixes it: recipe mix_teleport.)
create or replace function public.use_teleport_stone(p_dest text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare uid uuid := auth.uid(); p record; v_floor integer; v_path text; v_left integer;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select training_step, floor_unlocked into p from public.profiles where id = uid;
  if not found then raise exception 'unauthorized'; end if;
  if p.training_step < 100 then raise exception 'not_yet'; end if;
  if p_dest = 'guild' then v_path := '/home';
  elsif p_dest = 'lobby' then v_path := '/lobby';
  elsif p_dest = 'market' then v_path := '/market';
  elsif p_dest = 'arena' then v_path := '/arena';
  elsif p_dest ~ '^floor:[0-9]{1,3}$' then
    v_floor := substring(p_dest from 7)::int;
    if v_floor < 1 or v_floor > coalesce(p.floor_unlocked, 1) then raise exception 'floor_locked'; end if;
    v_path := '/floor/' || v_floor;
  else raise exception 'bad_destination'; end if;
  update public.player_items set qty = qty - 1 where owner_id = uid and item_slug = 'teleport_stone' and qty > 0 returning qty into v_left;
  if v_left is null then raise exception 'none left'; end if;
  delete from public.player_items where owner_id = uid and qty <= 0;
  return v_path;
end $$;
revoke all on function public.use_teleport_stone(text) from public, anon;
grant execute on function public.use_teleport_stone(text) to authenticated;

update public.item_templates set blurb = 'Carries your party to the guild, a town or any floor you have unlocked.' where slug = 'teleport_stone';
insert into public.market_goods (slug, buy_price, sell_price, sort) values ('teleport_stone', 350, 120, 10)
  on conflict (slug) do update set buy_price = excluded.buy_price, sell_price = excluded.sell_price, sort = excluded.sort;
