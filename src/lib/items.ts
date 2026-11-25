/** The shared UI icon sheet (bag, coins, scroll...) and each monster drop's own picture in /items. */
export const UI_SHEET = { src: "/ui/icons.png", cols: 6, rows: 5 };
export const UI_CELLS = { bag: [0, 4], gem: [2, 0], heart: [2, 1], crown: [4, 3], scroll: [0, 2], quest: [1, 2], coins: [1, 0], star: [3, 0] } as const;
export type UiCell = keyof typeof UI_CELLS;

import ART from "./item-art.json";

/** Potions: what each does (a share of max health or mana, or a revive) and its name. Prices live in the database (market_goods). */
export const POTIONS: Record<string, { kind: "hp" | "mp" | "revive"; frac: number; name: string }> = {
  hp_potion: { kind: "hp", frac: 0.33, name: "Health Potion (S)" }, hp_potion_m: { kind: "hp", frac: 0.5, name: "Health Potion (M)" },
  hp_potion_l: { kind: "hp", frac: 0.75, name: "Health Potion (L)" }, hp_potion_max: { kind: "hp", frac: 1, name: "Health Potion (Max)" },
  mp_potion: { kind: "mp", frac: 0.33, name: "Mana Potion (S)" }, mp_potion_m: { kind: "mp", frac: 0.5, name: "Mana Potion (M)" },
  mp_potion_l: { kind: "mp", frac: 0.75, name: "Mana Potion (L)" }, mp_potion_max: { kind: "mp", frac: 1, name: "Mana Potion (Max)" },
  revive_potion: { kind: "revive", frac: 0.5, name: "Revive Potion" },
};
export const POTION_SLUGS = Object.keys(POTIONS);

/** An item's picture; until its own art is added to /public/items it borrows the nearest potion's. */
export const itemImage = (slug: string) => {
  if ((ART as string[]).includes(slug)) return `/items/${slug}.png`;
  const k = POTIONS[slug]?.kind;
  if (!k) return "/items/golem_shard.png"; // monster parts that have no picture yet
  return `/items/${k === "mp" ? "mp_potion" : "hp_potion"}.png`;
};

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export const RARITY: Record<string, { ring: string; text: string; label: string }> = {
  common: { ring: "border-paper/40", text: "text-paper/70", label: "Common" },
  uncommon: { ring: "border-leaf", text: "text-leaf", label: "Uncommon" },
  rare: { ring: "border-sky", text: "text-sky", label: "Rare" },
  legendary: { ring: "border-gold", text: "text-gold", label: "Legendary" },
};

/** "goblin_ear" -> "Goblin Ear" (the drop slugs are their names). */
const NAMES: Record<string, string> = { ...Object.fromEntries(Object.entries(POTIONS).map(([k, v]) => [k, v.name])), teleport_stone: "Teleport Stone" };
export const itemName = (slug: string) => NAMES[slug] ?? slug.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
