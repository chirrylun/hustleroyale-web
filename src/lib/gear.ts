/** Equipment: shapes, labels and the same class / level rules the database enforces (gear_equip), so screens can explain a "no" before asking.
 *  Every piece is its own item with a rank (1-4, changes its look) and a level (1-10). Enhancing raises the level; at level 10 it can evolve to the next rank. */

export type GearSlot = "weapon" | "offhand" | "armor";
/** What the armourer sells (rank 1): the equipment_bases row. */
export interface GearBase {
  slug: string; name: string; slot: GearSlot; kind: string; classes: string[];
  atk: number; def: number; magic: number; hp: number; spd: number; base_price: number; sort: number;
}
/** A piece a player owns: the gear_items row (stats already worked out for its rank and level). */
export interface GearItem {
  id: string; base_slug: string; rank: number; level: number;
  atk: number; def: number; magic: number; hp: number; spd: number;
}
export type Stats = { atk: number; def: number; magic: number; hp: number; spd: number };

export const MAX_RANK = 4;
export const MAX_LEVEL = 10;
const RANK_MULT = [0, 1, 2.2, 4.2, 7];
const RANK_VALUE = [0, 1, 4, 16, 60];
const RANK_MIN_LEVEL = [0, 1, 15, 30, 45];
/** Fighter level needed to wear a rank (gear_rank_level). */
export const minLevel = (rank: number) => RANK_MIN_LEVEL[rank] ?? 1;
/** A stat at a given rank and level (gear_stat). */
export const gearStat = (base: number, rank: number, level: number) => Math.round(base * RANK_MULT[rank] * (1 + 0.1 * (level - 1)));
export const statsAt = (b: GearBase, rank: number, level: number): Stats => ({ atk: gearStat(b.atk, rank, level), def: gearStat(b.def, rank, level), magic: gearStat(b.magic, rank, level), hp: gearStat(b.hp, rank, level), spd: gearStat(b.spd, rank, level) });
export const sellPrice = (b: GearBase, rank: number, level: number) => Math.round(b.base_price * RANK_VALUE[rank] * (1 + 0.15 * (level - 1)) * 0.4);
export const enhanceCost = (b: GearBase, rank: number, level: number) => Math.ceil(b.base_price * RANK_VALUE[rank] * 0.2 * level);
export const evolveCost = (b: GearBase, rank: number) => Math.ceil(b.base_price * RANK_VALUE[rank + 1] * 0.5);
/** The picture key for a base at a rank, e.g. armor_warrior_2 (the sprite sheet and icon share it). */
export const artSlug = (baseSlug: string, rank: number) => `${baseSlug}_${rank}`;

export const rankName = (rank: number) => `Rank ${rank}`;
export const RANK_TEXT = ["", "text-paper/70", "text-leaf", "text-sky", "text-gold"];
export const RANK_RING = ["", "border-paper/40", "border-leaf", "border-sky", "border-gold"];
export const SLOT_LABEL: Record<GearSlot, string> = { weapon: "Weapon", offhand: "Shield", armor: "Armor" };
const KIND_GLYPH: Record<string, string> = { dagger: "🗡️", sword: "⚔️", mace: "🔨", staff: "🪄", shield: "🛡️", broadshield: "🛡️", armor: "🥋" };
export const kindGlyph = (kind: string) => KIND_GLYPH[kind] ?? "❔";

/** A fighter's class for gear: today's archetypes map onto the new class tree (mirrors gear_class in the database). */
export function gearClass(archetype: string): string {
  switch (archetype) {
    case "recruit_fighter": return "fighter";
    case "recruit_acolyte": return "healer";
    case "recruit_thief": return "rogue";
    case "fighter_tank": case "debuff_tank": return "warrior";
    case "healer_tank": return "warden";
    case "healer_fighter": return "battle_medic";
    case "rogue": return "thief";
    case "magical_dps": return "mage";
    default: return archetype;
  }
}

export const CLASS_LABEL: Record<string, string> = {
  novice: "Novice", fighter: "Fighter", soldier: "Soldier", warrior: "Warrior", warden: "Warden", paladin: "Paladin", shield_tank: "Shield Tank", bard: "Bard",
  rogue: "Rogue", thief: "Thief", ninja: "Ninja", samurai: "Samurai",
  healer: "Healer", battle_medic: "Battle Medic", pure_healer: "Pure Healer",
  mage: "Mage", necromancer: "Necromancer", blackmage: "Blackmage", whitemage: "Whitemage",
  ranger: "Ranger", archer: "Archer", marksman: "Marksman", sharpshooter: "Sharpshooter",
};
export const classLabel = (b: GearBase) => {
  const names = b.classes.map((c) => CLASS_LABEL[c] ?? c);
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
};

/** Why this fighter can't wear it, or null if they can. */
export function whyNot(b: GearBase, rank: number, f: { level: number; template: { archetype: string } }): string | null {
  if (!b.classes.includes(gearClass(f.template.archetype))) return `${b.slot === "armor" ? CLASS_LABEL[b.classes[0]] ?? b.classes[0] : "Other classes"} only`;
  if (f.level < minLevel(rank)) return `Needs level ${minLevel(rank)}`;
  return null;
}

export const statLine = (i: Stats) =>
  ([["ATK", i.atk], ["DEF", i.def], ["MAG", i.magic], ["HP", i.hp], ["SPD", i.spd]] as const).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join("  ");

export const GEAR_MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford that.", not_enough_items: "You don't have that piece.", item_worn: "Take it off first (worn gear can't be sold).", max_level: "Already at level 10. Evolve it instead.", max_rank: "Already at the top rank.", needs_level_10: "It must be level 10 to evolve.",
  not_for_sale: "The armourer doesn't deal in that.", unauthorized: "Please sign in again.",
  wrong_class: "That fighter's class can't use this.", level_too_low: "That fighter's level is too low.", not_your_fighter: "That isn't your fighter.",
};
export const gearError = (message: string) => GEAR_MESSAGES[Object.keys(GEAR_MESSAGES).find((k) => message.includes(k)) ?? ""] ?? "That didn't work. Try again.";

/** "male" or "female", read from a novice's sprite key (class sprites are one look, so the default is fine). */
export const genderOf = (f?: { template: { sprite_key: string } } | null) => (f?.template.sprite_key.endsWith("female") ? "female" : "male");
