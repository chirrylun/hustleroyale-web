export type Role = "tank" | "healer" | "dps";
/** Effect sheets: 4 rows (one effect each) x 4 frames. hit: physical, heavy, magic, crit. support: heal, shield, buff, debuff. shot: dart, magic, fire, holy. status: stun, death, shield break, danger. */
export type FxSheet = "hit" | "support" | "shot" | "status";

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

/** Each fighter wears the sheet for its class and rarity. */
export const sheetUrl = (key: string, role: Role) => `/sprites/${role}_${RARITY[TIER[key] ?? 0]}.png`;
