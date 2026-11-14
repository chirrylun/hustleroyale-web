import { nearestWalkable, type Nav, type Pt } from "@/lib/guild-nav";
import type { Stance } from "@/lib/battle";

/*
 * How the party behaves on a floor while the player is not steering it.
 *   Attack   - hunts the nearest foe anywhere on the map and goes straight for it.
 *   Balanced - strolls calmly toward the mobs and fights whatever comes close.
 *   Defend   - holds a spot, fights only what comes near it, then walks back.
 */

export const STANCES: { id: Stance; label: string; hint: string }[] = [
  { id: "offensive", label: "Attack", hint: "Hunt the nearest foe" },
  { id: "neutral", label: "Balanced", hint: "Stroll and fight what comes near" },
  { id: "defensive", label: "Defend", hint: "Hold ground" },
];

export interface StanceRule {
  /** How far (tiles) a fighter looks for something to fight. */
  aggro: number;
  /** A foe only counts when it is this close to the spot being held (Infinity: no limit). */
  leash: number;
  /** Speed multiplier while heading for a foe. */
  charge: number;
}

export const RULES: Record<Stance, StanceRule> = {
  offensive: { aggro: 200, leash: Infinity, charge: 1.1 },
  neutral: { aggro: 7, leash: Infinity, charge: 1 },
  defensive: { aggro: 4.5, leash: 6.5, charge: 1 },
};

/** How fast the leader strolls while idle, relative to its walking pace. */
export const STROLL_SPEED = 0.55;

/**
 * Speed multiplier for a follower heading to its place in the formation. It eases off as it arrives, instead of
 * running at full speed and stopping dead, and does not move at all when it is already close enough.
 */
export const arriveEase = (d: number) => (d < 0.12 ? 0 : Math.min(1.15, 0.3 + d * 0.5));

/** A fighter that is standing still only sets off once it is this far from its slot... */
export const START_MOVING = 0.55;
/** ...and, once walking, keeps going until it is this close. Two thresholds stop it from twitching at the edge. */
export const STOP_MOVING = 0.15;

/** A slow, continuous drift away from its slot, so a standing party looks alive without anyone twitching. */
export function sway(phase: number, now: number): Pt {
  return [Math.sin(now / 2300 + phase) * 0.22, Math.cos(now / 3100 + phase * 1.7) * 0.18];
}

/** Where the party strolls next: a few tiles toward the nearest mob patch, with a little sideways drift. */
export function strollGoal(nav: Nav, from: Pt, zones: readonly (readonly number[])[], rand: () => number = Math.random): Pt {
  let towards: number | null = null, nearest = Infinity;
  for (const z of zones) {
    const d = Math.hypot(z[0] - from[0], z[1] - from[1]);
    if (d > 3 && d < nearest) { nearest = d; towards = Math.atan2(z[1] - from[1], z[0] - from[0]); }
  }
  const len = Math.min(3.5 + rand() * 2, nearest);
  const ang = towards === null ? rand() * Math.PI * 2 : towards + (rand() - 0.5) * 0.9;
  return nearestWalkable(nav, from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len);
}
