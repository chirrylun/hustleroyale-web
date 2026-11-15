import { ZOOM } from "./zoom";
import { walkable, type Nav, type Pt } from "@/lib/guild-nav";

/*
 * How a party of fighters and a crowd of mobs spread out on the map, so nobody ends up standing on the
 * same spot: a loose formation that turns with the direction of travel, and a gentle push that keeps
 * bodies apart.
 */

/** Who stands where in the formation: tanks up front, healers at the back. */
export const ROLE_RANK = { tank: 0, dps: 1, healer: 2 } as const;

/** Slot positions in the party's own frame: x forward, y to the side (tiles). Slot 0 leads. */
const LOCAL: Pt[][] = [
  [[0, 0]],
  [[0, 0]],
  [[1.1, 0], [-1.1, 0]],
  [[1.3, 0], [-1.0, -1.5], [-1.0, 1.5]],
];

/** Where slot `slot` of `n` stands relative to the leader (slot 0) when the party faces `heading` (radians). */
export function formationOffset(slot: number, n: number, heading: number): Pt {
  const L = LOCAL[Math.min(Math.max(n, 1), 3)];
  const p = L[Math.min(slot, L.length - 1)];
  const lx = p[0] - L[0][0], ly = p[1] - L[0][1];
  const c = Math.cos(heading), s = Math.sin(heading);
  return [(lx * c - ly * s) / ZOOM, (lx * s + ly * c) / ZOOM];
}

/** Smallest signed difference between two angles. */
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** A spot on a ring around a target, at `angle`, where an attacker can stand. */
export const ringPoint = (t: { x: number; y: number }, angle: number, radius: number): Pt => [t.x + Math.cos(angle) * radius, t.y + Math.sin(angle) * radius];

/** Nudges overlapping bodies apart. Only moves a body onto ground it may stand on. */
export function separate(units: { x: number; y: number }[], nav: Nav, minD = 1.05 / ZOOM, strength = 0.3) {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= minD) continue;
      if (d < 1e-3) { const t = (i * 2.399 + j) % 6.283; dx = Math.cos(t); dy = Math.sin(t); d = 1; }
      const push = (minD - Math.min(d, minD)) * strength;
      const nx = dx / d, ny = dy / d;
      if (walkable(nav, a.x - nx * push, a.y - ny * push)) { a.x -= nx * push; a.y -= ny * push; }
      if (walkable(nav, b.x + nx * push, b.y + ny * push)) { b.x += nx * push; b.y += ny * push; }
    }
  }
}

/** How many mobs a floor holds at once and how often a new one walks in, for `players` on the floor. */
export function spawnPlan(base: number, players: number) {
  const k = 1 + 0.5 * (Math.max(1, players) - 1);
  return { cap: Math.round(base * k), gapMs: [7000 / k, 12000 / k] as [number, number], afterKillMs: [6000 / k, 10000 / k] as [number, number] };
}
