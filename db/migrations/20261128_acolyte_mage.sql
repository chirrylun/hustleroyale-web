-- Acolytes (healer role) may take Mage and Black Mage: class_tree.also_roles lists extra roles that can reach a class, and the fighter takes the class's own role.
-- Applied via the Supabase migration "acolytes_can_take_mage_classes" (also redefines class_changer, change_class and choose_class to honour also_roles).
alter table public.class_tree add column if not exists also_roles text[] not null default '{}';
update public.class_tree set also_roles = '{healer}' where archetype in ('magical_dps','blackmage');
