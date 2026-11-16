import data from "./maps.json";
import atlas from "../../../public/town/props.json";

/**
 * The town maps (lobby and marketplace). Each is one painted picture with props standing on it, much like a
 * floor but smaller. Everything in maps.json is in picture pixels; the helpers here turn that into the tiles
 * the walking code (guild-nav) works in.
 */
export type TownId = "market" | "lobby";

export interface TownProp { i: number; x: number; y: number; href?: string; label?: string }
export interface TownNpc { npc: string; facing: "front" | "left" | "right"; x: number; y: number; action: string }
export interface TownMap {
  title: string;
  ground: string;
  /** Size of the picture in picture pixels. */
  w: number;
  h: number;
  floor: [number, number, number, number];
  blocks: [number, number, number, number][];
  spawn: [number, number];
  props: TownProp[];
  npcs: TownNpc[];
  /** Other players share this map live. */
  online: boolean;
}

/** On-screen pixels per picture pixel, and per tile. */
export const SCALE = data.scale;
export const TILE_PX = 48;
/** Picture pixels in one tile. */
export const UNIT = TILE_PX / SCALE;
export const ATLAS = atlas as { w: number; h: number; rects: [number, number, number, number][] };

export const TOWNS = data.maps as unknown as Record<TownId, TownMap>;
export const isTown = (id: string): id is TownId => id in TOWNS;

/** Footprint of a prop in tiles: the bottom strip, a bit narrower than the picture of it. */
export function footOf(p: TownProp): number[] {
  const [, , w, h] = ATLAS.rects[p.i];
  return [(p.x - w * 0.34) / UNIT, (p.y - Math.min(h * 0.2, 34)) / UNIT, (p.x + w * 0.34) / UNIT, (p.y + 4) / UNIT];
}

/** The walking layout for guild-nav. */
export function navLayoutOf(town: TownMap) {
  const [x0, y0, x1, y1] = town.floor;
  return {
    cols: Math.ceil(town.w / UNIT), rows: Math.ceil(town.h / UNIT),
    floor: { x0: x0 / UNIT, y0: y0 / UNIT, x1: x1 / UNIT, y1: y1 / UNIT },
    props: [...town.props.map((p) => ({ foot: footOf(p) })), ...town.blocks.map((b) => ({ foot: b.map((v) => v / UNIT) }))],
  };
}

/** How tall an NPC's frame stands, in picture pixels (the figure fills it). Sized so a trader stands a touch taller than a fighter. */
export const NPC_HEIGHT = 136;
