export type Role = "tank" | "healer" | "dps";
/** Effect sheets: 4 rows (one effect each) x 4 frames. hit: physical, heavy, magic, crit. support: heal, shield, buff, debuff. shot: dart, magic, fire, holy. status: stun, death, shield break, danger. */
export type FxSheet = "hit" | "support" | "shot" | "status" | "shot2" | "support2" | "ground"
  // Skill art (see src/lib/skill-art.ts): slash/arrow/bolt/impact/dark/heal/guard/music/move/extra.
  | "slash" | "arrow" | "bolt" | "impact" | "dark" | "heal" | "guard" | "music" | "move" | "extra";

/** Sheet layout produced by tools/build_sprites.py: 6 columns, one row per animation. */
export const ANIMS = [
  { name: "idle", n: 4 }, { name: "walk", n: 6 }, { name: "attack", n: 5 }, { name: "cast", n: 5 }, { name: "hurt", n: 2 }, { name: "windup", n: 2 },
] as const;
export type AnimName = (typeof ANIMS)[number]["name"];
export const COLS = 6;

export const FX_COLS = 4;
export const FX_ROWS = 4;

const RARITY = ["common", "uncommon", "rare", "legendary"] as const;
const TIER: Record<string, number> = {
  danfo_guard: 0, iron_iya: 1, oga_patapata: 2, agbero_king: 3,
  herbal_hawker: 0, native_doctor: 1, sister_grace: 2, priestess_of_eko: 3,
  street_scrapper: 0, gen_mage: 1, molue_mauler: 2, eko_shadow: 3,
};

/** Archetypes that have their own sheet at /sprites/<archetype>_<rarity>.png. Add a name here once its four sheets are in. */
const ARCHETYPE_ART = new Set<string>(["paladin", "bard", "marksman", "necromancer", "rogue", "magical_dps"]);

/**
 * Mob sheets all draw the creature big enough to fill its frame, which makes a slime as tall as a hero and
 * three times as wide. This scales each kind to a believable size next to a fighter (about 1.8 m, 120 px
 * of a frame): slimes knee-high, bats the size of bats, a wolf long and low. Bosses keep the full size.
 */
const MOB_SCALE: Record<string, number> = { slime: 0.3, bat: 0.35, mushroom: 0.5, goblin: 0.6, direwolf: 0.62, golem: 1 };
export const mobScale = (spriteKey: string): number => {
  const m = /^mob_([a-z]+)_/.exec(spriteKey);
  return m ? (MOB_SCALE[m[1]] ?? 1) : 1;
};

/** Keys look like `<archetype>_<rarity>`. Archetypes without art yet wear their class sheet at the same rarity. */
export const sheetUrl = (key: string, role: Role) => {
  if (key.startsWith("armor_")) return `/sprites/${key}.png`; // a full armour set: the item slug is the sprite key
  if (key.startsWith("gear_")) return `/gear/preview/${key.slice(5)}.png`; // a weapon or shield overlay, drawn over a fighter's sheet
  if (key === "skeleton" || key === "novice_male" || key === "novice_female" || key.startsWith("mob_") || key.startsWith("recruit_")) return `/sprites/${key}.png`;
  const i = key.lastIndexOf("_");
  const rarity = key.slice(i + 1);
  if (RARITY.includes(rarity as (typeof RARITY)[number])) {
    const arch = key.slice(0, i);
    return ARCHETYPE_ART.has(arch) ? `/sprites/${key}.png` : `/sprites/${role}_${rarity}.png`;
  }
  return `/sprites/${role}_${RARITY[TIER[key] ?? 0]}.png`;
};

/**
 * Every hero is drawn to the mage's size. The sheets are close but not identical (novices read bulky, the paladin small,
 * a few rarities are over- or under-sized), so each gets a small correction, applied around the feet.
 */
const ARCH_SCALE: Record<string, number> = { novice: 0.9, paladin: 1.1, recruit: 0.92 };
const SHEET_SCALE: Record<string, number> = { healer_legendary: 0.92, tank_legendary: 0.95, tank_rare: 1.04, tank_uncommon: 1.07, necromancer_legendary: 1.07, marksman_legendary: 1.05, healer_uncommon: 1.04 };
export const heroScale = (spriteKey: string, role: Role): number => {
  if (spriteKey.startsWith("mob_") || spriteKey === "skeleton") return 1;
  if (spriteKey.startsWith("gear_")) return ARCH_SCALE.novice; // overlays are drawn over the novice, so they share its size
  const url = sheetUrl(spriteKey, role).replace("/sprites/", "").replace(".png", "");
  const arch = url.split("_")[0];
  return (SHEET_SCALE[url] ?? 1) * (ARCH_SCALE[arch] ?? 1);
};
