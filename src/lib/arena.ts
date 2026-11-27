import type { BossId, RangeId } from "@/lib/battle";
import type { Role } from "@/lib/starter-pack";

/** What the arena screen shows about each mode. The numbers that matter (stats, balance) live on the game server; keep names and levels in step with it (modules/battle/arena.ts). */

export const RANGES: { id: RangeId; min: number; max: number; theme: string; bosses: [BossId, BossId] }[] = [
  { id: "10-20", min: 10, max: 20, theme: "Hollow Depths", bosses: ["goblin", "golem"] },
  { id: "20-30", min: 20, max: 30, theme: "Murkwater Marsh", bosses: ["golem", "mushroom"] },
  { id: "30-40", min: 30, max: 40, theme: "Frostbite Reach", bosses: ["mushroom", "direwolf"] },
];

export const BOSSES: Record<BossId, { name: string; floor: number; level: number; role: Role; blurb: string }> = {
  goblin: { name: "Goblin Warlord", floor: 10, level: 12, role: "dps", blurb: "Hits hard and often. Watch for the red circle of his Ground Slam." },
  golem: { name: "Stone Colossus", floor: 20, level: 22, role: "tank", blurb: "Slow and huge. Its Quake covers half the arena. Magic cracks its plating." },
  mushroom: { name: "Spore Matriarch", floor: 30, level: 32, role: "dps", blurb: "Poisons the whole team over time and grows back what you take off." },
  direwolf: { name: "Alpha Direwolf", floor: 40, level: 42, role: "dps", blurb: "Fast. Pounces on whoever is furthest out, then howls to hit harder." },
};

export const RAID_STAGES = 10;
/** Mob level on a raid floor: the bottom of the range on floor 1, the top on floor 9. Floor 10 is the boss. */
export const raidLevel = (r: { min: number; max: number }, stage: number) => r.min + Math.round(((r.max - r.min) * (Math.min(stage, RAID_STAGES - 1) - 1)) / (RAID_STAGES - 2));

export const bossSprite = (id: BossId) => `mob_${id}_legendary`;

export const fmtTime = (ms: number) => { const s = ms / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; };

/** The range a team of this average level belongs in (or the nearest). */
export const rangeFor = (avg: number): RangeId => (avg >= 30 ? "30-40" : avg >= 20 ? "20-30" : "10-20");

export interface BoardRow { rank: number; name: string; time_ms: number; you: boolean; team: { name: string; role: Role; level: number; spriteKey: string }[] }
