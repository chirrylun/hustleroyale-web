"use client";

import { useState } from "react";
import { Arena } from "@/components/battle/Arena";
import { StanceBar } from "@/components/battle/ArenaScreen";
import { PixelButton } from "@/components/pixel/PixelButton";
import { useSoloBattle } from "@/lib/battle";
import { InfoBox } from "./InfoBox";

const COPY = {
  1: {
    title: "Your first fight",
    intro: ["The best way to learn how fights work is by entering your first fight.", "Let's jump right in!."],
    live: "Your fighter fights on its own. You can also tap anywhere on the ground to make it walk there instead and to back away if it gets hurt.",
    moved: "It walks where you tap. Tap a Slime to focus on it, or press Auto to let your fighter fight again.",
    win: ["Victory!", "That's how a fight works: your fighter acts on its own, and you step in when you need to."],
  },
  2: {
    title: "Team fight",
    intro: ["It works the same way in a team.", "Everyone acts on their own. You only choose how they act, they still make their own decisions."],
    live: "Your team fights on its own. Pick how they act below: Attack makes them more bold and charge in, Defend makes them hold back and heal early.",
    moved: "",
    win: ["Well fought!", "Your team is ready. Let's head to your guild."],
  },
} as const;

/** One scripted tutorial fight against level 1 slimes (nothing is saved or paid). */
export function TutorialFight({ stage, step, total, onWin, onBack }: { stage: 1 | 2; step: number; total: number; onWin: () => void; onBack?: () => void }) {
  const { phase, view, error, startTutorial, focus, move, auto, setStance, reset } = useSoloBattle();
  const [moved, setMoved] = useState(false);
  const c = COPY[stage];
  const controlled = view?.controlledUnitId ?? null;

  if ((phase === "fighting" || phase === "ended") && view) {
    const won = view.end?.result === "win";
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <Arena
          view={view}
          phase={phase}
          canFocus={!!controlled && phase === "fighting"}
          canMove={!!controlled && phase === "fighting" && !view.end}
          onFocus={focus}
          onMove={(x, y) => {
            setMoved(true);
            move(x, y);
          }}
        />
        {phase === "fighting" && (
          <div className="pixel-box card-reveal bg-night p-4 text-xl text-paper" aria-live="polite">
            <p>{stage === 1 && moved ? c.moved : c.live}</p>
            {controlled ? (
              <PixelButton variant="ghost" className="mt-3 text-base" onClick={() => { setMoved(false); auto(); }}>Auto</PixelButton>
            ) : (
              <div className="mt-3"><StanceBar current={view.stances[1]} onPick={setStance} /></div>
            )}
          </div>
        )}
        {phase === "ended" && (
          <InfoBox
            step={step}
            total={total}
            title={won ? c.win[0] : "Not this time"}
            onNext={won ? onWin : () => { setMoved(false); reset(); }}
            nextLabel={won ? "Continue" : "Try again"}
          >
            <p>{won ? c.win[1] : "That's okay, the Slimes are tough for a first-timer. Give it another go."}</p>
          </InfoBox>
        )}
      </div>
    );
  }

  return (
    <InfoBox step={step} total={total} title={c.title} onBack={onBack} onNext={() => startTutorial(stage)} nextLabel={phase === "starting" ? "Starting..." : "Fight!"} busy={phase === "starting"}>
      {c.intro.map((t) => <p key={t}>{t}</p>)}
      {error && <p role="alert" className="text-base text-ember">{error}</p>}
    </InfoBox>
  );
}
