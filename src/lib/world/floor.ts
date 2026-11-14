import cave from "./props_cave.json";
import grass from "./props_grass.json";
import ice from "./props_ice.json";
import swamp from "./props_swamp.json";
import type { NavLayout } from "../guild-nav";

/**
 * Adventure floors. A floor is generated from its number alone (same number, same map), so the server
 * and every player in a room can rebuild it without sending the map around.
 * 40 floors, 10 per theme; the tenth floor of each theme is a boss floor.
 */

export const TILE_SRC = 64; // tile size in the atlas images
export const MAP_W = 40;
export const MAP_H = 28;
export const MAX_FLOOR = 40;

type Rect = { x: number; y: number; w: number; h: number };
export type ThemeId = "grass" | "cave" | "swamp" | "ice";
type Cat = "big" | "mid" | "flat";

interface Theme {
  id: ThemeId;
  name: string;
  atlas: { url: string; w: number; h: number; rects: Rect[] };
  /** Prop indices in the atlas by role. */
  big: number[]; mid: number[]; flat: number[];
  entry: number; exit: number; boss: number; chest: number;
  /** The ice exit sits next to a nest in the atlas, so only the left part of its rectangle is used. */
  exitCrop?: number;
  mobs: string[]; boss_mob: string;
  /** Tile rows in the atlas: [grass A, path, liquid]. */
  rows: [number, number, number];
  /** Ground tile columns that match each other in tone, so the grass doesn't look like a checkerboard. */
  ground: number[];
}

const atlas = (id: ThemeId, w: number, h: number, rects: Rect[]) => ({ url: `/world/props_${id}.png`, w, h, rects });

export const THEMES: Record<ThemeId, Theme> = {
  grass: {
    id: "grass", name: "Whispering Meadows", atlas: atlas("grass", 1024, 381, grass),
    big: [0, 1, 2, 3, 4], mid: [6, 7, 8, 10, 11, 5, 12, 13], flat: [9, 14, 15, 16, 17],
    entry: 24, exit: 25, boss: 27, chest: 28, mobs: ["slime", "bat", "mushroom"], boss_mob: "goblin", rows: [0, 1, 4], ground: [3, 4, 6, 7],
  },
  cave: {
    id: "cave", name: "Hollow Depths", atlas: atlas("cave", 1024, 385, cave),
    big: [0, 1, 2, 3], mid: [4, 5, 6, 7, 8, 9, 18, 19, 14], flat: [15, 16, 11],
    entry: 22, exit: 23, boss: 25, chest: 26, mobs: ["bat", "slime", "goblin"], boss_mob: "golem", rows: [0, 1, 4], ground: [2, 4, 7, 0],
  },
  swamp: {
    id: "swamp", name: "Murkwater Marsh", atlas: atlas("swamp", 1024, 385, swamp),
    big: [0, 1, 2, 3, 4], mid: [5, 10, 12, 16, 22], flat: [6, 7, 8, 9, 14, 15, 20],
    entry: 24, exit: 25, boss: 27, chest: 28, mobs: ["slime", "mushroom", "goblin"], boss_mob: "mushroom", rows: [0, 1, 4], ground: [3, 0, 1, 6],
  },
  ice: {
    id: "ice", name: "Frostbite Reach", atlas: atlas("ice", 1024, 385, ice),
    big: [0, 1, 2, 3, 4], mid: [5, 6, 7, 8, 9, 11, 13], flat: [12, 15],
    entry: 25, exit: 26, boss: 27, chest: 28, exitCrop: 0.5, mobs: ["slime", "direwolf", "golem"], boss_mob: "direwolf", rows: [0, 1, 4], ground: [5, 0, 1, 2],
  },
};

const ORDER: ThemeId[] = ["grass", "cave", "swamp", "ice"];
export const themeOf = (floor: number) => THEMES[ORDER[Math.min(3, Math.floor((floor - 1) / 10))]];
export const isBossFloor = (floor: number) => floor % 10 === 0;
const RARITY = ["common", "uncommon", "rare", "legendary"] as const;

export interface PropSpec {
  id: number;
  idx: number;
  x: number; y: number; // bottom centre, in tiles
  /** Display size of the prop's width, in tiles. */
  w: number;
  crop?: number;
  kind: "tree" | "prop" | "decor" | "entry" | "exit" | "boss" | "chest";
}
export interface MobSpec {
  id: number;
  kind: string;
  rarity: (typeof RARITY)[number];
  sprite: string;
  level: number;
  boss: boolean;
  x: number; y: number;
  hp: number; atk: number; def: number;
}
export interface Floor {
  n: number;
  theme: Theme;
  w: number; h: number;
  /** One cell per tile: 0 ground, 1 path, 2 liquid. */
  cells: Uint8Array;
  /** Tile column used for each ground tile. */
  variant: Uint8Array;
  props: PropSpec[];
  mobs: MobSpec[];
  start: [number, number];
  exit: [number, number];
  nav: NavLayout;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mob numbers by level. Placeholder balance: tune with play. */
export const mobStats = (level: number, boss: boolean) => ({
  hp: Math.round((40 + 22 * level) * (boss ? 6 : 1)),
  atk: Math.round((7 + 3.2 * level) * (boss ? 1.4 : 1)),
  def: Math.round(2 + 1.2 * level),
});

export function generateFloor(n: number): Floor {
  const theme = themeOf(n);
  const rand = rng(n * 7919 + 13);
  const r = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const W = MAP_W, H = MAP_H;
  const cells = new Uint8Array(W * H);
  const variant = new Uint8Array(W * H);
  for (let i = 0; i < variant.length; i++) variant[i] = theme.ground[Math.floor(rand() * 4)];

  const boss = isBossFloor(n);
  const start: [number, number] = [4, H / 2];
  const exit: [number, number] = [W - 5, r(9, H - 9)];

  // A winding road from the entry to the exit, with a clearing at each bend.
  const way: [number, number][] = [start];
  const bends = 5;
  for (let i = 1; i <= bends; i++) way.push([start[0] + ((exit[0] - start[0]) * i) / (bends + 1), r(6, H - 7)]);
  way.push(exit);
  const clearings: [number, number, number][] = [];
  way.forEach((p, i) => { if (i > 0 && i < way.length - 1) clearings.push([p[0], p[1], r(2.6, 3.6)]); });
  const dist = new Float32Array(W * H).fill(99); // distance to the road
  const road = (x: number, y: number, rad: number) => {
    for (let j = Math.max(0, Math.floor(y - rad - 1)); j < Math.min(H, Math.ceil(y + rad + 1)); j++)
      for (let i = Math.max(0, Math.floor(x - rad - 1)); i < Math.min(W, Math.ceil(x + rad + 1)); i++) {
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - y);
        if (d < dist[j * W + i]) dist[j * W + i] = d;
        if (d < rad) cells[j * W + i] = 1;
      }
  };
  for (let s = 0; s < way.length - 1; s++) {
    const [ax, ay] = way[s], [bx, by] = way[s + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= steps; k++) road(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps + Math.sin(k / 5 + s) * 0.8, 1.15);
  }
  for (const [x, y, rad] of clearings) road(x, y, rad);
  road(start[0], start[1], 2.4);
  road(exit[0], exit[1], boss ? 4 : 2.4);

  // Lakes, kept off the road.
  for (let k = 0, lakes = 1 + Math.floor(rand() * 2); k < lakes; k++) {
    const cx = r(10, W - 10), cy = r(5, H - 5), rx = r(2, 3.5), ry = r(1.5, 2.6);
    let ok = true;
    for (let j = 0; j < H && ok; j++) for (let i = 0; i < W; i++) {
      if (((i + 0.5 - cx) / (rx + 1.5)) ** 2 + ((j + 0.5 - cy) / (ry + 1.5)) ** 2 < 1 && dist[j * W + i] < 2.2) { ok = false; break; }
    }
    if (!ok) continue;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 < 1) cells[j * W + i] = 2;
    }
  }

  const props: PropSpec[] = [];
  const feet: { foot: number[] | null }[] = [];
  let pid = 0;
  const A = theme.atlas;
  const put = (idx: number, x: number, y: number, w: number, kind: PropSpec["kind"], crop?: number, foot?: number[] | null) => {
    props.push({ id: pid++, idx, x, y, w, kind, crop });
    feet.push({ foot: foot ?? null });
  };
  const rw = (idx: number) => A.rects[idx].w / TILE_SRC;
  const FOOT: Record<Cat, (x: number, y: number) => number[] | null> = {
    big: (x, y) => [x - 0.35, y - 0.35, x + 0.35, y + 0.05],
    mid: (x, y) => [x - 0.4, y - 0.3, x + 0.4, y + 0.05],
    flat: () => null,
  };
  const SIZE: Record<Cat, number> = { big: 0.78, mid: 0.62, flat: 0.5 };
  const scatter = (cat: Cat, x: number, y: number) => {
    const idx = pick(theme[cat]);
    put(idx, x, y, rw(idx) * SIZE[cat] * r(0.9, 1.1), cat === "big" ? "tree" : cat === "mid" ? "prop" : "decor", undefined, FOOT[cat](x, y));
  };

  // Dense border so nobody sees past the edge of the map.
  const edge = 1.7;
  for (let x = 0.4; x < W; x += r(0.9, 1.3)) { scatter("big", x, r(0.8, edge)); scatter("big", x, H - r(0.1, edge - 0.9)); }
  for (let y = 1.8; y < H - 0.4; y += r(0.9, 1.3)) { scatter("big", r(0.2, edge - 0.5), y); scatter("big", W - r(0.2, edge - 0.5), y); }

  // Scenery in the open ground.
  const open = (x: number, y: number, gap: number) => {
    const i = Math.floor(x), j = Math.floor(y);
    return i > 1 && j > 2 && i < W - 2 && j < H - 1 && cells[j * W + i] === 0 && dist[j * W + i] > gap;
  };
  for (let k = 0, tries = 0; k < 85 && tries < 600; tries++) {
    const x = r(2, W - 2), y = r(3, H - 1);
    const roll = rand();
    const cat: Cat = roll < 0.32 ? "big" : roll < 0.6 ? "mid" : "flat";
    if (!open(x, y, cat === "flat" ? 1.2 : 2.2)) continue;
    scatter(cat, x, y);
    k++;
  }

  // Portals, boss ring, a chest off the beaten track.
  put(theme.entry, start[0], start[1] + 0.9, rw(theme.entry) * 0.7, "entry", undefined, [start[0] - 0.5, start[1] + 0.3, start[0] + 0.5, start[1] + 0.9]);
  if (boss) put(theme.boss, exit[0] - 2.5, exit[1] + 1.2, rw(theme.boss) * 0.95, "boss");
  put(theme.exit, exit[0] + (boss ? 2.6 : 0), exit[1] + 0.9, rw(theme.exit) * (theme.exitCrop ?? 1) * 0.7, "exit", theme.exitCrop, [exit[0] + (boss ? 2.1 : -0.5), exit[1] + 0.3, exit[0] + (boss ? 3.1 : 0.5), exit[1] + 0.9]);
  for (let t = 0; t < 40; t++) {
    const x = r(4, W - 4), y = r(5, H - 3);
    if (open(x, y, 3)) { put(theme.chest + 0, x, y, rw(theme.chest) * 0.45, "chest", undefined, [x - 0.3, y - 0.2, x + 0.3, y + 0.05]); break; }
  }

  // Mobs live in the clearings; the tenth floor of a theme has its boss in the ring by the exit.
  const f = ((n - 1) % 10) + 1;
  const tier = f <= 3 ? 0 : f <= 6 ? 1 : 2;
  const mobs: MobSpec[] = [];
  const spawn = (kind: string, rarity: MobSpec["rarity"], level: number, isBoss: boolean, x: number, y: number) => {
    const s = mobStats(level, isBoss);
    mobs.push({ id: mobs.length, kind, rarity, sprite: `mob_${kind}_${rarity}`, level, boss: isBoss, x, y, ...s });
  };
  const count = Math.min(9, 4 + Math.floor(f / 2));
  for (let i = 0; i < count; i++) {
    const c = clearings[i % clearings.length];
    const a = rand() * Math.PI * 2, d = r(0.4, Math.max(0.6, c[2] - 1.1));
    // Floor 1 always has a bat, so the first job can be done there.
    const kind = n === 1 && i === 0 ? "bat" : pick(theme.mobs);
    spawn(kind, RARITY[tier], Math.max(1, n + (i % 3 === 2 ? 1 : 0)), false, c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.7);
  }
  if (boss) spawn(theme.boss_mob, "legendary", n + 2, true, exit[0] - 2.5, exit[1] - 0.2);

  return {
    n, theme, w: W, h: H, cells, variant, props, mobs, start, exit,
    nav: { cols: W, rows: H, floor: { x0: 1.2, x1: W - 1.2, y0: 2.4, y1: H - 1 }, props: [...feet, ...liquidFeet(cells, W, H)] },
  };
}

/** Lakes block walking: one footprint per horizontal run of liquid tiles. */
function liquidFeet(cells: Uint8Array, W: number, H: number) {
  const out: { foot: number[] }[] = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (cells[j * W + i] !== 2) continue;
      let e = i;
      while (e + 1 < W && cells[j * W + e + 1] === 2) e++;
      out.push({ foot: [i, j, e + 1, j + 1] });
      i = e;
    }
  }
  return out;
}
