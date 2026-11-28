-- Class tree rework.
--  * Bard is a first-tier Acolyte class of its own (no Battle Medic needed first).
--  * Paladin is the Acolyte class after Battle Medic (the old healer_tank template; the old tank-role paladin is retired, nobody held it).
--  * Warden (debuff_tank) grows out of the Fighter (fighter_tank); Knight is shield_tank. Names live in src/lib/guild.ts.
delete from public.class_tree where archetype = 'paladin';
update public.class_tree set tier = 1, requires = null, min_level = 20 where archetype = 'bard';
update public.class_tree set tier = 2, requires = 'healer_fighter', min_level = 35 where archetype = 'healer_tank';
