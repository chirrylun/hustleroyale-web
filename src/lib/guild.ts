import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rarity, Role, StarterFighter } from "./starter-pack";

export const ROSTER_CAP = 10;

/** Level needed to take each class rank (mirrors rank_level_req in the database). */
export const RANK_LEVEL: Record<Rarity, number> = { common: 10, uncommon: 20, rare: 35, legendary: 50 };
export const RANK_LABEL: Record<Rarity, string> = { common: "Rank 1", uncommon: "Rank 2", rare: "Rank 3", legendary: "Rank 4" };
export const NEXT_RANK: Record<Rarity, Rarity | null> = { common: "uncommon", uncommon: "rare", rare: "legendary", legendary: null };

/** XP a level costs (mirrors xp_required in the database). */
export const xpRequired = (level: number) => 30 + 22 * level + 4 * level * level;

export const ARCHETYPE_LABEL: Record<string, string> = {
  novice: "Novice",
  shield_tank: "Shield Tank", fighter_tank: "Fighter Tank", debuff_tank: "Debuff Tank", paladin: "Paladin",
  pure_healer: "Pure Healer", healer_fighter: "Battle Medic", healer_tank: "Warden", bard: "Bard",
  rogue: "Rogue", magical_dps: "Mage", marksman: "Marksman", necromancer: "Necromancer",
};

export const CLASSES: Record<Role, { id: string; blurb: string }[]> = {
  tank: [
    { id: "shield_tank", blurb: "Soaks hits and shields the team." },
    { id: "fighter_tank", blurb: "Tough brawler that taunts enemies." },
    { id: "debuff_tank", blurb: "Weakens enemies and reflects damage." },
    { id: "paladin", blurb: "Holy knight that guards and heals allies." },
  ],
  healer: [
    { id: "pure_healer", blurb: "The strongest healing in the guild." },
    { id: "healer_fighter", blurb: "Fights in the front line and heals." },
    { id: "healer_tank", blurb: "Sturdy warden that cleanses and shields." },
    { id: "bard", blurb: "Boosts allies and slows enemies with song." },
  ],
  dps: [
    { id: "rogue", blurb: "Fast striker with dodges and finishing blows." },
    { id: "magical_dps", blurb: "Ranged mage with stuns and area spells." },
    { id: "marksman", blurb: "Long-range archer with poison and volleys." },
    { id: "necromancer", blurb: "Drains life, curses foes and raises skeletons." },
  ],
};

interface Row {
  id: string;
  grade: StarterFighter["grade"];
  level: number;
  xp: number;
  team_slot: number | null;
  hp: number; atk: number; def: number; spd: number; stamina: number; magic: number;
  template: StarterFighter["template"];
  fighter_skills: { slot: number; skill: { name: string } | null }[] | null;
}

export type GuildFighter = StarterFighter & { xp: number };

/** The signed-in player's fighters (RLS only returns their own). */
export async function loadFighters(supabase: SupabaseClient, userId: string): Promise<GuildFighter[]> {
  const { data } = await supabase
    .from("fighters")
    .select("id, grade, level, xp, team_slot, hp, atk, def, spd, stamina, magic, template:fighter_templates(name, role, archetype, rarity, sprite_key), fighter_skills(slot, skill:skills(name))")
    .eq("owner_id", userId)
    .order("team_slot", { ascending: true, nullsFirst: false });
  return ((data ?? []) as unknown as Row[]).map((f) => ({
    id: f.id, grade: f.grade, level: f.level, xp: f.xp, team_slot: f.team_slot ?? 0,
    hp: f.hp, atk: f.atk, def: f.def, spd: f.spd, stamina: f.stamina, magic: f.magic, template: f.template,
    skills: (f.fighter_skills ?? []).map((s) => ({ slot: s.slot, name: s.skill?.name ?? "" })).sort((a, b) => a.slot - b.slot),
  }));
}
