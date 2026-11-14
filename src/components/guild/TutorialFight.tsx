"use client";

import { Arena } from "@/components/battle/Arena";
import { StanceBar } from "@/components/battle/ArenaScreen";
import { PixelButton } from "@/components/pixel/PixelButton";
import { useSoloBattle } from "@/lib/battle";
import { InfoBox } from "./InfoBox";

/*
 * Everything the player needs to read comes before the fight. The arena is shown frozen with the
 * instructions beside it, and nothing moves until they press Start. Once it is running the screen
 * shows only the controls, so there is nothing to read in the middle of a fight.
 */
const COPY = {
  1: {
    title: "Your first fight",
    intro: ["The best way to learn how fights work is by entering your first fight.", "Let's jump right in!."],
    ready: "How it works",
    read: [
      "Your fighter fights on its own. You can also tap anywhere on the ground to make it walk there instead and to back away if it gets hurt.",
      "It walks where you tap. Tap a Slime to focus on it, or press Auto to let your fighter fight again.",
    ],
    win: ["Victory!", "That's how a fight works: your fighter acts on its own, and you step in when you need to."],
  },
  2: {
    title: "Team fight",
    intro: ["It works the same way in a team.", "Everyone acts on their own. You only choose how they act, they still make their own decisions."],
    ready: "How it works",
    read: [
      "Your team fights on its own. Pick how they act below: Attack makes them more bold and charge in, Defend makes them hold back and heal early.",
    ],
    win: ["Well fought!", "Your team is ready. Let's head to your guild."],
  },
} as const;

/** One scripted tutorial fight against level 1 slimes (nothing is saved or paid). */
export function TutorialFight({ stage, step, total, onWin, onBack }: { stage: 1 | 2; step: number; total: number; onWin: () => void; onBack?: () => void }) {
  const { phase, view, error, startTutorial, beginTutorial, focus, move, auto, setStance, reset } = useSoloBattle();
  const c = COPY[stage];
  const controlled = view?.controlledUnitId ?? null;

  if ((phase === "ready" || phase === "fighting" || phase === "ended") && view) {
    const won = view.end?.result === "win";
    const fighting = phase === "fighting";
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <Arena
          view={view}
          phase={phase}
          canFocus={!!controlled && fighting}
          canMove={!!controlled && fighting && !view.end}
          onFocus={focus}
          onMove={move}
        />
        {phase === "ready" && (
          <div className="mx-auto w-full max-w-xl">
            <InfoBox step={step} total={total} title={c.ready} onBack={reset} onNext={beginTutorial} nextLabel="Start fight!">
              {c.read.map((t) => <p key={t}>{t}</p>)}
              {error && <p role="alert" className="text-base text-ember">{error}</p>}
            </InfoBox>
          </div>
        )}
        {fighting && (
          <div className="pixel-box card-reveal bg-night p-4 text-paper">
            {controlled ? (
              <PixelButton variant="ghost" className="text-base" onClick={auto}>Auto</PixelButton>
            ) : (
              <StanceBar current={view.stances[1]} onPick={setStance} />
            )}
          </div>
        )}
        {phase === "ended" && (
          <InfoBox
            step={step}
            total={total}
            title={won ? c.win[0] : "Not this time"}
            onNext={won ? onWin : reset}
            nextLabel={won ? "Continue" : "Try again"}
          >
            <p>{won ? c.win[1] : "That's okay, the Slimes are tough for a first-timer. Give it another go."}</p>
          </InfoBox>
        )}
      </div>
    );
  }

  return (
    <InfoBox step={step} total={total} title={c.title} onBack={onBack} onNext={() => startTutorial(stage)} nextLabel={phase === "starting" ? "Loading..." : "To the arena"} busy={phase === "starting"}>
      {c.intro.map((t) => <p key={t}>{t}</p>)}
      {error && <p role="alert" className="text-base text-ember">{error}</p>}
    </InfoBox>
  );
}