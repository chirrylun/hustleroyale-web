export type Role = "tank" | "healer" | "dps";
export type Head = "helm" | "hood" | "gele" | "bandana" | "crown" | "cap" | "veil" | "hair";
export type Weapon = "mace" | "sword" | "axe" | "hammer" | "pipe" | "dagger" | "staff" | "crook" | "cross" | "cane" | "wand";
export interface Design {
  cls: Role; tier: 0 | 1 | 2 | 3;
  skin: number; hair: number; main: number; sub: number; trim: number; metal: number; glow: number;
  head: Head; weapon: Weapon; off: "shield" | "dagger" | "satchel" | "none"; halo?: boolean;
}
const S = { brown: 0x8d5524, tan: 0xc68642, dark: 0x5c3317, ink: 0x1a1c2c };
export const DESIGNS: Record<string, Design> = {
  // Tanks: wide, armoured, shield + helm. Rarity adds pauldron spikes, plume, cape, gold.
  danfo_guard: { cls: "tank", tier: 0, skin: S.brown, hair: S.ink, main: 0xf2c230, sub: 0x29366f, trim: S.ink, metal: 0x94b0c2, glow: 0xffcd75, head: "helm", weapon: "mace", off: "shield" },
  iron_iya: { cls: "tank", tier: 1, skin: S.dark, hair: S.ink, main: 0x94b0c2, sub: 0x3b5dc9, trim: 0xef7d57, metal: 0xb8c8d6, glow: 0x73eff7, head: "gele", weapon: "mace", off: "shield" },
  oga_patapata: { cls: "tank", tier: 2, skin: S.tan, hair: S.ink, main: 0x3b5dc9, sub: 0x333c57, trim: 0xffcd75, metal: 0xb8c8d6, glow: 0x41a6f6, head: "helm", weapon: "axe", off: "shield" },
  agbero_king: { cls: "tank", tier: 3, skin: S.brown, hair: S.ink, main: 0xffcd75, sub: 0xb13e53, trim: 0xfff4dc, metal: 0xf2c230, glow: 0xffcd75, head: "crown", weapon: "axe", off: "shield" },
  // Healers: flowing robes, staffs, glowing orbs. Rarity adds trim, halo, sleeves of light.
  herbal_hawker: { cls: "healer", tier: 0, skin: S.tan, hair: S.dark, main: 0x38b764, sub: 0xf4f4f4, trim: 0xa7f070, metal: 0x8b5a2b, glow: 0xa7f070, head: "cap", weapon: "crook", off: "satchel" },
  native_doctor: { cls: "healer", tier: 1, skin: S.dark, hair: S.ink, main: 0xb13e53, sub: 0xf4f4f4, trim: 0xffcd75, metal: 0xf4f4f4, glow: 0xef7d57, head: "hair", weapon: "cane", off: "none" },
  sister_grace: { cls: "healer", tier: 2, skin: S.tan, hair: S.ink, main: 0xf4f4f4, sub: 0x41a6f6, trim: 0xffcd75, metal: 0xffcd75, glow: 0x73eff7, head: "veil", weapon: "cross", off: "none", halo: true },
  priestess_of_eko: { cls: "healer", tier: 3, skin: S.brown, hair: S.ink, main: 0xf4f4f4, sub: 0xffcd75, trim: 0xffcd75, metal: 0xffcd75, glow: 0x73eff7, head: "gele", weapon: "staff", off: "none", halo: true },
  // DPS: lean, forward-leaning, bare arms, scarves; blades and hit-and-run silhouettes.
  street_scrapper: { cls: "dps", tier: 0, skin: S.tan, hair: S.ink, main: 0xef7d57, sub: 0x29366f, trim: 0xf4f4f4, metal: 0x94b0c2, glow: 0xffcd75, head: "bandana", weapon: "pipe", off: "none" },
  gen_mage: { cls: "dps", tier: 1, skin: S.brown, hair: S.ink, main: 0x41a6f6, sub: 0x333c57, trim: 0xffcd75, metal: 0xffcd75, glow: 0xffee66, head: "cap", weapon: "wand", off: "none" },
  molue_mauler: { cls: "dps", tier: 2, skin: S.dark, hair: S.ink, main: 0xb13e53, sub: 0x333c57, trim: 0xffcd75, metal: 0x94b0c2, glow: 0xef7d57, head: "bandana", weapon: "hammer", off: "none" },
  eko_shadow: { cls: "dps", tier: 3, skin: S.brown, hair: S.ink, main: 0x5d275d, sub: 0x1a1c2c, trim: 0x73eff7, metal: 0xb8c8d6, glow: 0x73eff7, head: "hood", weapon: "dagger", off: "dagger" },
};
const FALLBACK: Record<Role, string> = { tank: "danfo_guard", healer: "herbal_hawker", dps: "street_scrapper" };
export const designFor = (key: string, role: Role): Design => DESIGNS[key] ?? DESIGNS[FALLBACK[role]];
