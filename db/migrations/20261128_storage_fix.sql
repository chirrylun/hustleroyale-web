-- Taking the last of an item out of storage failed: item_storage has CHECK (qty > 0), so qty - n = 0 was rejected before the delete.
-- Remove the row instead when it empties, and add a batch move (all or nothing) for multi-select.
create or replace function public.storage_move(p_slug text, p_qty integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  uid uuid := auth.uid(); cap integer; used integer; have integer; n integer := abs(p_qty); bag integer;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_qty = 0 or n > 1000 then raise exception 'bad_quantity'; end if;
  select storage_cap into cap from public.profiles where id = uid for update;
  if cap is null then raise exception 'unauthorized'; end if;
  select coalesce(sum(qty), 0) into used from public.item_storage where owner_id = uid;
  if p_qty > 0 then
    if used + n > cap then raise exception 'storage_full'; end if;
    select qty into have from public.player_items where owner_id = uid and item_slug = p_slug for update;
    if have is null or have < n then raise exception 'not_enough_items'; end if;
    if have = n then delete from public.player_items where owner_id = uid and item_slug = p_slug;
    else update public.player_items set qty = qty - n where owner_id = uid and item_slug = p_slug; end if;
    insert into public.item_storage (owner_id, item_slug, qty) values (uid, p_slug, n)
      on conflict (owner_id, item_slug) do update set qty = public.item_storage.qty + n;
  else
    select coalesce(sum(qty), 0) into bag from public.player_items where owner_id = uid;
    if bag + n > 100 then raise exception 'bag_full'; end if;
    select qty into have from public.item_storage where owner_id = uid and item_slug = p_slug for update;
    if have is null or have < n then raise exception 'not_enough_items'; end if;
    if have = n then delete from public.item_storage where owner_id = uid and item_slug = p_slug;
    else update public.item_storage set qty = qty - n where owner_id = uid and item_slug = p_slug; end if;
    insert into public.player_items (owner_id, item_slug, qty) values (uid, p_slug, n)
      on conflict (owner_id, item_slug) do update set qty = public.player_items.qty + n;
  end if;
  select coalesce(sum(qty), 0) into used from public.item_storage where owner_id = uid;
  return jsonb_build_object('used', used, 'cap', cap);
end $$;

-- p_moves: [{"slug": "...", "qty": 3}, ...] (positive = into the box, negative = back to the bag). One transaction: any failure undoes all.
create or replace function public.storage_move_many(p_moves jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare m jsonb; res jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_moves) <> 'array' or jsonb_array_length(p_moves) > 100 then raise exception 'bad_quantity'; end if;
  for m in select * from jsonb_array_elements(p_moves) loop
    res := public.storage_move(m->>'slug', (m->>'qty')::int);
  end loop;
  return res;
end $$;
grant execute on function public.storage_move_many(jsonb) to authenticated;
