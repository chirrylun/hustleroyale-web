/** Equipment: the shapes, labels and the same class / level rules the database enforces (gear_equip), so the screens can explain a "no" before asking. */

export type GearSlot = "weapon" | "offhand" | "armor";
export interface GearItem {
  slug: string; name: string; slot: GearSlot; kind: string; rank: number; min_level: number; classes: string[];
  atk: number; def: number; magic: number; hp: number; spd: number; buy_price: number; sell_price: number; sort: number;
}

export const RANK_NAME = ["", "Rookie", "Soldier", "Knight", "Runed"];
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
    case "shield_tank": case "fighter_tank": case "debuff_tank": return "warrior";
    case "healer_tank": case "bard": return "pure_healer";
    case "healer_fighter": return "battle_medic";
    case "rogue": return "thief";
    case "magical_dps": return "blackmage";
    default: return archetype;
  }
}

export const CLASS_LABEL: Record<string, string> = {
  novice: "Novice", fighter: "Fighter", soldier: "Soldier", warrior: "Warrior", paladin: "Paladin",
  rogue: "Rogue", thief: "Thief", ninja: "Ninja", samurai: "Samurai",
  healer: "Healer", battle_medic: "Battle Medic", pure_healer: "Pure Healer",
  mage: "Mage", necromancer: "Necromancer", blackmage: "Blackmage", whitemage: "Whitemage",
  ranger: "Ranger", archer: "Archer", marksman: "Marksman", sharpshooter: "Sharpshooter",
};
export const classLabel = (item: GearItem) => {
  const names = item.classes.map((c) => CLASS_LABEL[c] ?? c);
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
};

/** Why this fighter can't wear it, or null if they can. */
export function whyNot(item: GearItem, f: { level: number; template: { archetype: string } }): string | null {
  if (!item.classes.includes(gearClass(f.template.archetype))) return `${item.slot === "armor" ? CLASS_LABEL[item.classes[0]] ?? item.classes[0] : "Other classes"} only`;
  if (f.level < item.min_level) return `Needs level ${item.min_level}`;
  return null;
}

export const statLine = (i: GearItem) =>
  ([["ATK", i.atk], ["DEF", i.def], ["MAG", i.magic], ["HP", i.hp], ["SPD", i.spd]] as const).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join("  ");

export const GEAR_MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford that.", not_enough_items: "You don't have a spare one (worn gear can't be sold).",
  not_for_sale: "The armourer doesn't deal in that.", unauthorized: "Please sign in again.",
  wrong_class: "That fighter's class can't use this.", level_too_low: "That fighter's level is too low.", not_your_fighter: "That isn't your fighter.",
};
export const gearError = (message: string) => GEAR_MESSAGES[Object.keys(GEAR_MESSAGES).find((k) => message.includes(k)) ?? ""] ?? "That didn't work. Try again.";
