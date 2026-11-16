/** Where each monster drop's picture lives: its own file in /items, or a cell of the shared UI sheet. */
export const UI_SHEET = { src: "/ui/icons.png", cols: 6, rows: 5 };
export const UI_CELLS = { bag: [0, 4], gem: [2, 0], heart: [2, 1], crown: [4, 3], scroll: [0, 2], quest: [1, 2], coins: [1, 0], star: [3, 0] } as const;
export type UiCell = keyof typeof UI_CELLS;

const SHEET_ITEMS: Record<string, UiCell> = { goblin_crown: "crown", golem_heart: "heart", golem_shard: "gem" };
export const itemCell = (slug: string): UiCell | null => SHEET_ITEMS[slug] ?? null;
export const itemImage = (slug: string) => `/items/${slug}.png`;

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export const RARITY: Record<string, { ring: string; text: string; label: string }> = {
  common: { ring: "border-paper/40", text: "text-paper/70", label: "Common" },
  uncommon: { ring: "border-leaf", text: "text-leaf", label: "Uncommon" },
  rare: { ring: "border-sky", text: "text-sky", label: "Rare" },
  legendary: { ring: "border-gold", text: "text-gold", label: "Legendary" },
};
