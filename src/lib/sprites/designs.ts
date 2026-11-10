export type Role = "tank" | "healer" | "dps";
export type FxSheet = "tank" | "healer" | "dps" | "shared";

/** Sheet layout produced by tools/build_sprites.py: 6 columns, one row per animation. */
export const ANIMS = [
  { name: "idle", n: 4 }, { name: "walk", n: 6 }, { name: "attack", n: 5 }, { name: "cast", n: 5 }, { name: "hurt", n: 2 }, { name: "windup", n: 2 },
] as const;
export type AnimName = (typeof ANIMS)[number]["name"];
export const COLS = 6;

/** Effect sheets are 6 rows (one animation each); tank has 7 frames per row, the rest 6. */
export const FX_COLS: Record<FxSheet, number> = { tank: 7, healer: 6, dps: 6, shared: 6 };

const RARITY = ["common", "uncommon", "rare", "legendary"] as const;
const TIER: Record<string, number> = {
  danfo_guard: 0, iron_iya: 1, oga_patapata: 2, agbero_king: 3,
  herbal_hawker: 0, native_doctor: 1, sister_grace: 2, priestess_of_eko: 3,
  street_scrapper: 0, gen_mage: 1, molue_mauler: 2, eko_shadow: 3,
};

/** Each fighter wears the sheet for its class and rarity. */
export const sheetUrl = (key: string, role: Role) => `/sprites/${role}_${RARITY[TIER[key] ?? 0]}.png`;
