/*
 * How each role fights, on a floor or in the arena (the game server's battle engine follows the same ideas).
 *   Tank    - meets the enemy head on, up close, and keeps the others behind it.
 *   Healer  - hangs back behind the party. With a weapon it attacks from long range; without one it only heals.
 *   DPS     - fights up close or from a distance by class, and when hurt falls back to mid range until healed, then returns.
 */
export type Role = "tank" | "healer" | "dps";

/** Classes that shoot or cast from range. */
const RANGED_CLASSES = new Set(["marksman", "sharpshooter", "ranger", "magical_dps", "blackmage", "necromancer", "whitemage", "bard"]);

export interface Kit { /** Has a weapon in hand (a healer without one does not fight). */ armed: boolean; /** Attacks from a distance. */ ranged: boolean }

export function kitOf(role: Role, archetype: string, weapon: string | null): Kit {
  const armed = !!weapon;
  const ranged = role === "healer" ? armed : weapon === "staff" || weapon === "bow" || RANGED_CLASSES.has(archetype);
  return { armed, ranged };
}

export const MELEE_REACH = 1.35;
export const RANGED_REACH = 4.4;
/** A hurt fighter drops back at this much health, and returns once it has this much. */
export const RECOVER_BELOW = 0.4;
export const RECOVER_ABOVE = 0.75;
/** Where a fighter that is hurt (or a healer) stands relative to the enemy: mid range. */
export const MID_RANGE = 4.6;

export interface Engage {
  /** Attacks from here or closer. */
  reach: number;
  /** Where it tries to stand relative to its target. */
  stand: number;
  /** Whether it goes after enemies at all (otherwise it stays with the party). */
  fights: boolean;
}

export function engagement(role: Role, kit: Kit, recovering: boolean): Engage {
  if (role === "tank") return { reach: MELEE_REACH, stand: 1.0, fights: true };
  if (role === "healer") return kit.ranged ? { reach: RANGED_REACH, stand: RANGED_REACH * 0.85, fights: true } : { reach: 0, stand: MID_RANGE, fights: false };
  if (kit.ranged) return { reach: RANGED_REACH, stand: RANGED_REACH * (recovering ? 0.95 : 0.8), fights: true };
  return recovering ? { reach: 0, stand: MID_RANGE, fights: false } : { reach: MELEE_REACH, stand: 1.0, fights: true };
}
