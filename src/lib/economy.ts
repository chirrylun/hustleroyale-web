import type { Difficulty } from "@/lib/battle";

/**
 * Display-only copy of the practice-match economy. The game server and database are the
 * authority on what a match actually pays; these numbers only tell the player what to expect.
 * Keep them in step with `modules/battle/rewards.ts` in hustle-royale-server.
 */
export const DAILY_CAP = 250;

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; hint: string; win: number; color: string }> = {
  rookie: { label: "Rookie", hint: "A little weaker than you", win: 12, color: "bg-leaf" },
  hustler: { label: "Hustler", hint: "About as strong as you", win: 20, color: "bg-gold" },
  boss: { label: "Boss", hint: "A bit stronger than you", win: 32, color: "bg-ember" },
};
