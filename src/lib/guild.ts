import { TUNE } from "@/lib/world/floor";
import { lookKey } from "@/lib/look";
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
  novice: "Novice", recruit_acolyte: "Recruit Acolyte", recruit_fighter: "Recruit Fighter", recruit_thief: "Recruit Thief",
  shield_tank: "Shield Tank", fighter_tank: "Fighter Tank", debuff_tank: "Debuff Tank", paladin: "Paladin",
  pure_healer: "Pure Healer", healer_fighter: "Battle Medic", healer_tank: "Warden", bard: "Bard",
  rogue: "Rogue", magical_dps: "Mage", marksman: "Marksman", necromancer: "Necromancer",
  ninja: "Ninja", samurai: "Samurai", soldier: "Soldier", sharpshooter: "Sharpshooter", ranger: "Ranger", whitemage: "White Mage", blackmage: "Black Mage",
};

/** Level 10: a Novice becomes a Recruit of its role. Level 20: a Recruit specialises (CLASSES). */
export const RECRUITS: Record<Role, { id: string; blurb: string }> = {
  tank: { id: "recruit_fighter", blurb: "Learns Slash. Tough front-liner in training." },
  healer: { id: "recruit_acolyte", blurb: "Learns Basic Heal. Keeps allies standing." },
  dps: { id: "recruit_thief", blurb: "Learns Stab and Dodge. Quick and slippery." },
};
export const RECRUIT_ADVANCE_LEVEL = 20;
export const isRecruit = (archetype: string) => archetype.startsWith("recruit_");

/** First-tier classes only: the second tier (Paladin, Debuff Tank, Warden, Bard, Marksman, Necromancer) is reached later through the class changer in town. */
export const CLASSES: Record<Role, { id: string; blurb: string }[]> = {
  tank: [
    { id: "shield_tank", blurb: "Soaks hits and shields the team." },
    { id: "fighter_tank", blurb: "Tough brawler that taunts enemies." },
  ],
  healer: [
    { id: "pure_healer", blurb: "The strongest healing in the guild." },
    { id: "healer_fighter", blurb: "Fights in the front line and heals." },
  ],
  dps: [
    { id: "rogue", blurb: "Fast striker with dodges and finishing blows." },
    { id: "magical_dps", blurb: "Ranged mage with stuns and area spells." },
  ],
};

interface Row {
  id: string;
  grade: StarterFighter["grade"];
  level: number;
  xp: number;
  gender: string;
  skill_points?: number;
  gear?: GearRows;
  team_slot: number | null;
  hp: number; hp_frac?: number; hp_at?: string; atk: number; def: number; spd: number; stamina: number; magic: number;
  template: StarterFighter["template"];
  fighter_skills: { slot: number; skill: { name: string; kind: string; damage_type: string; power: number | string; cooldown_ms: number; stamina_cost: number; description: string | null } | null }[] | null;
}

export type GuildFighter = StarterFighter & { gender?: string; xp: number; skill_points?: number; hp_frac?: number; hp_at?: string };

/** The signed-in player's fighters (RLS only returns their own). */
export async function loadFighters(supabase: SupabaseClient, userId: string): Promise<GuildFighter[]> {
  const { data } = await supabase
    .from("fighters")
    .select("id, grade, level, xp, gender, skill_points, team_slot, hp, hp_frac, hp_at, atk, def, spd, stamina, magic, template:fighter_templates(name, role, archetype, rarity, sprite_key), fighter_skills(slot, skill:skills(name, kind, damage_type, power, cooldown_ms, stamina_cost, description)), gear:fighter_gear(slot, item:gear_items(base_slug, rank, atk, def, magic, hp, spd))")
    .eq("owner_id", userId)
    .order("team_slot", { ascending: true, nullsFirst: false });
  return ((data ?? []) as unknown as Row[]).map((f) => { const gb = gearTotals(f.gear, f as unknown as Stat5); return ({
    id: f.id, grade: f.grade, level: f.level, xp: f.xp, skill_points: f.skill_points, team_slot: f.team_slot ?? 0,
    hp: f.hp + gb.hp, hp_frac: f.hp_frac, hp_at: f.hp_at, atk: f.atk + gb.atk, def: f.def + gb.def, spd: f.spd + gb.spd, stamina: f.stamina, magic: f.magic + gb.magic, gender: f.gender, template: { ...f.template, sprite_key: lookKey(f.gender, f.gear) },
    skills: (f.fighter_skills ?? []).map((s) => ({ slot: s.slot, name: s.skill?.name ?? "", kind: s.skill?.kind, damage_type: s.skill?.damage_type, power: s.skill ? Number(s.skill.power) : undefined, cooldown_ms: s.skill?.cooldown_ms, stamina_cost: s.skill?.stamina_cost, description: s.skill?.description })).sort((a, b) => a.slot - b.slot),
  }); });
}

type GearRows = { slot: string; item: (Stat5 & { base_slug: string; rank: number }) | (Stat5 & { base_slug: string; rank: number })[] | null }[] | null | undefined;
type Stat5 = { atk: number; def: number; magic: number; hp: number; spd: number };
/** What a fighter's worn gear adds (same sum the game server uses for rooms and battles). */
function gearTotals(rows: GearRows, own?: Stat5): Stat5 {
  const t = { atk: 0, def: 0, magic: 0, hp: 0, spd: 0 };
  for (const r of rows ?? []) { const i = Array.isArray(r.item) ? r.item[0] : r.item; if (i) { t.atk += i.atk; t.def += i.def; t.magic += i.magic; t.hp += i.hp; t.spd += i.spd; } }
  // Gear is a boost, not the whole fighter: at most 40% of a stat (TUNE.gearCap, mirrored on the server).
  if (own) for (const k of ["hp", "atk", "def", "magic", "spd"] as const) t[k] = Math.min(t[k], Math.floor(own[k] * TUNE.gearCap));
  return t;
}
