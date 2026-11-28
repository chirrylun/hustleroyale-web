import sizes from "@/components/guild/rankSizes.json";

/**
 * The guild hall at its four ranks. Every rank is one 2048 x 2048 picture; the working props (map, job board,
 * arena door, ...) are drawn per rank and stand at the same places, so a rank change is only a new look.
 * Everything here is a fraction of the picture (0..1); the walking code works in tiles of TILE picture pixels.
 */
export const STAGE = 2048;
export const TILE = 64;
export const TILES = STAGE / TILE; // 32 x 32 tiles
export const MAX_RANK = 4;
export const RANK_NAME = ["", "Humble Lodge", "Craftsman's Hall", "Grand Hall", "Royal Hall"];
/** Where the floor starts (feet can stand from here down) and its side limits. */
export const FLOOR = { x0: 0.06, x1: 0.94, y0: 0.4, y1: 0.95 };
/** How big the rank props are drawn compared to their files, and the old furniture compared to its files. */
const K = 0.9;
export const DECOR_K = 1.5;
/** A fighter's sprite frame, in tiles. */
export const HALL_FRAME = 3.9;

export interface HallProp {
  id: string;
  /** Opens this when tapped (a panel, or a page). */
  group: string;
  label?: string;
  /** Picture file: rank props come from /guild/props/r<rank>/, the rest from /guild/props/. */
  art: string;
  rankArt: boolean;
  /** Centre and feet, as fractions of the picture. */
  cx: number; fy: number;
  /** Size in picture pixels. */
  w: number; h: number;
  href?: string;
  action?: string;
  /** Where a visiting fighter stands (fractions) and what it does there. */
  spot?: [number, number];
  emote?: string;
  work?: string;
  /** Footprint (fractions of the picture: x0, y0, x1, y1), solid to walkers. */
  foot?: [number, number, number, number];
}

const sz = (rank: number, n: string): [number, number] => {
  const s = (sizes as unknown as Record<string, Record<string, number[]>>)[String(rank)][n];
  return [s[0] * K, s[1] * K];
};
const footOf = (cx: number, fy: number, w: number, h: number): [number, number, number, number] => [cx - (w / STAGE) * 0.36, fy - (h / STAGE) * 0.1, cx + (w / STAGE) * 0.36, fy + 0.006];

function rankProp(rank: number, id: string, art: string, p: Partial<HallProp> & { cx: number; fy: number }): HallProp {
  const [w, h] = sz(rank, art);
  return { id, group: id, art, rankArt: true, w, h, foot: footOf(p.cx, p.fy, w, h), ...p };
}
function oldProp(id: string, p: Partial<HallProp> & { cx: number; fy: number; w: number; h: number }): HallProp {
  const w = p.w * DECOR_K, h = p.h * DECOR_K;
  return { group: id, art: id, rankArt: false, ...p, id, w, h, foot: p.foot ?? footOf(p.cx, p.fy, w, h) };
}

/** The props that work: they stay in the same place whatever the rank. */
export function fixtures(rank: number): HallProp[] {
  return [
    rankProp(rank, "map", "map", { group: "adventure", label: "Adventure", cx: 0.1, fy: 0.55, action: "adventure", spot: [0.1, 0.6], emote: "🗺" }),
    rankProp(rank, "board", "board", { group: "jobs", label: "Job Board", cx: 0.2, fy: 0.395, action: "jobs", spot: [0.12, 0.5], emote: "📜" }),
    rankProp(rank, "arena", "arena", { group: "arena", label: "Arena", cx: 0.34, fy: 0.4, href: "/arena", spot: [0.34, 0.47], emote: "⚔️" }),
    rankProp(rank, "plaque", "plaque", { group: "leaderboard", label: "Leaderboard", cx: 0.63, fy: 0.4, href: "/leaderboard", spot: [0.63, 0.47], emote: "🏆" }),
    rankProp(rank, "market", "market", { group: "market", label: "Market", cx: 0.89, fy: 0.4, href: "/market", spot: [0.89, 0.47], emote: "🛒" }),
    rankProp(rank, "portal", "portal", { group: "lobby", label: "Main Lobby", cx: 0.88, fy: 0.72, action: "lobby", spot: [0.88, 0.79], emote: "⬆" }),
    // The training yard, bottom left.
    oldProp("scarecrow", { group: "fighters", cx: 0.1, fy: 0.84, w: 72, h: 142, href: "/team", spot: [0.1, 0.9], work: "attack", foot: [0.085, 0.8, 0.115, 0.84] }),
    oldProp("target", { group: "fighters", label: "My Fighters", cx: 0.2, fy: 0.84, w: 70, h: 123, href: "/team", spot: [0.2, 0.9], work: "attack", foot: [0.185, 0.805, 0.215, 0.84] }),
    oldProp("rack", { group: "fighters", cx: 0.31, fy: 0.9, w: 137, h: 141, href: "/team", spot: [0.31, 0.96], emote: "🗡️" }),
  ];
}

/** Furniture catalogue art sizes (file size in pixels). Prices and names are in the database. */
export const DECOR_SIZE: Record<string, [number, number]> = {
  plant: [83, 116], barrels: [127, 118], crates: [129, 118], banner_blue: [55, 144], banner_red: [55, 144], candelabra: [73, 136],
  bunk_a: [152, 151], bunk_b: [152, 151], shelf: [150, 174], roundtable: [160, 136], chest: [156, 162], clock: [76, 158],
  banquet: [178, 118], anvil: [162, 143], statue: [72, 136], fireplace: [184, 223], dog: [151, 80],
};

export interface PlacedDecor { id: string; slug: string; x: number | null; y: number | null }

export function decorProp(d: PlacedDecor): HallProp | null {
  const s = DECOR_SIZE[d.slug];
  if (!s || d.x == null || d.y == null) return null;
  return oldProp(d.slug, { cx: d.x, fy: d.y, w: s[0], h: s[1] });
}

/** Everything standing in the hall for this rank and these placed pieces. */
export const hallProps = (rank: number, decor: PlacedDecor[]): HallProp[] => [...fixtures(rank), ...decor.flatMap((d) => { const p = decorProp(d); return p ? [{ ...p, id: `d:${d.id}` }] : []; })];

export const pct = (v: number) => `${v * 100}%`;
export const propSrc = (p: HallProp, rank: number) => (p.rankArt ? `/guild/props/r${rank}/${p.art}.png` : `/guild/props/${p.art}.png`);
