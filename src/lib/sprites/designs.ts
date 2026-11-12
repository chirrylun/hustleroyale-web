export type Role = "tank" | "healer" | "dps";
/** Effect sheets: 4 rows (one effect each) x 4 frames. hit: physical, heavy, magic, crit. support: heal, shield, buff, debuff. shot: dart, magic, fire, holy. status: stun, death, shield break, danger. */
export type FxSheet = "hit" | "support" | "shot" | "status" | "shot2" | "support2" | "ground";

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

/** Keys look like `<archetype>_<rarity>`. Archetypes without art yet wear their class sheet at the same rarity. */
export const sheetUrl = (key: string, role: Role) => {
  if (key === "skeleton") return "/sprites/necromancer_uncommon.png"; // stand-in until the minion has its own sheet
  const i = key.lastIndexOf("_");
  const rarity = key.slice(i + 1);
  if (RARITY.includes(rarity as (typeof RARITY)[number])) {
    return ARCHETYPE_ART.has(key.slice(0, i)) ? `/sprites/${key}.png` : `/sprites/${role}_${rarity}.png`;
  }
  return `/sprites/${role}_${RARITY[TIER[key] ?? 0]}.png`;
};
