/** The tutorial's training field. Progress is the profile's training_step (the database moves it; see training_advance). */
export const TRAINING_DONE = 100;
export type TrainingNpc = "manager" | "trainer" | "changer";

export const NPC_TAG: Record<TrainingNpc, string> = { manager: "Guild Manager", trainer: "Trainer", changer: "Class Changer" };
/** The sprite sheet each person uses (public/npc). */
export const NPC_SHEET = { manager: "manager", trainer: "trainer", changer: "class_changer" } as const;

/** Who the player should speak to next, by step. */
export const nextTalk = (step: number): TrainingNpc | null => {
  if (step === 0 || step === 6) return "manager";
  if (step >= 1 && step <= 5) return "trainer";
  return null;
};

/** The one-line goal shown along the top of the screen. */
export function objective(step: number, p: { kills: number; ready: number; total: number; potion: boolean; recruits: number }): string {
  switch (step) {
    case 0: return "Speak to the Guild Manager.";
    case 1: return "Speak to the Trainer.";
    case 2: return p.kills >= 1 ? "Quest done: report back to the Trainer." : "Quest 1: defeat a slime (tap one).";
    case 3: return p.ready >= p.total ? "Quest done: report back to the Trainer." : `Quest 2: get every fighter to level 5 (${p.ready}/${p.total}).`;
    case 4: return p.potion ? "Quest done: report back to the Trainer." : "Quest 3: put a potion in a shortcut slot.";
    case 5: return p.recruits >= p.total ? "Quest done: report back to the Trainer." : `Quest 4: become Recruits at the Class Changer (${p.recruits}/${p.total}).`;
    case 6: return "Training complete! Speak to the Guild Manager.";
    default: return "";
  }
}
