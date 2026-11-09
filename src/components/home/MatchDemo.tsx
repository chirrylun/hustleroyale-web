"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { ArenaBackdrop } from "./ArenaBackdrop";
import { createMatch, stepMatch, type FloatText, type Side, type Sim, type SimUnit } from "./matchSim";

const TICK_MS = 850;

const fxClass = (u: SimUnit) => {
  switch (u.fx.kind) {
    case "lunge":
      return u.side === "A" ? "fx-lunge-r" : "fx-lunge-l";
    case "hurt":
      return "fx-hurt";
    case "heal":
      return "fx-heal";
    case "shield":
      return "fx-shield";
    case "dead":
      return "fx-dead";
    default:
      return "";
  }
};

const textColor: Record<FloatText["kind"], string> = {
  dmg: "text-paper",
  crit: "text-gold",
  heal: "text-lime",
  shield: "text-ice",
  ko: "text-ember",
};

const teamName: Record<Side, string> = { A: "Blue team", B: "Red team" };

export function MatchDemo() {
  const [view, setView] = useState<Sim>(createMatch);

  useEffect(() => {
    let current = createMatch();
    const id = setInterval(() => {
      if (document.hidden) return; // do not burn battery in a background tab
      current = stepMatch(current, Math.random);
      setView(current);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const teamHp = (side: Side) => {
    const team = view.units.filter((u) => u.side === side);
    const hp = team.reduce((sum, u) => sum + u.hp, 0);
    const max = team.reduce((sum, u) => sum + u.maxHp, 0);
    return Math.round((hp / max) * 100);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="pixel-box relative aspect-[4/3] w-full overflow-hidden bg-ink sm:aspect-video"
        role="img"
        aria-label="A short animated demo of a match. Two teams of three fighters take turns attacking, healing and blocking until one team wins."
      >
        <ArenaBackdrop />

        {/* Team health bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-ink/70 px-2 py-1.5 sm:gap-4 sm:px-4">
          <TeamBar label={teamName.A} percent={teamHp("A")} color="bg-sky" />
          <span className="text-lg uppercase text-gold sm:text-2xl">VS</span>
          <TeamBar label={teamName.B} percent={teamHp("B")} color="bg-blood" reverse />
        </div>

        {/* Fighters, sorted so the ones lower on screen draw in front */}
        {[...view.units]
          .sort((a, b) => a.y - b.y)
          .map((u) => (
            <div
              key={u.id}
              className="absolute w-[16%] -translate-x-1/2 -translate-y-full sm:w-[14%]"
              style={{ left: `${u.x}%`, top: `${u.y}%`, zIndex: Math.round(u.y / 10) }}
              aria-hidden="true"
            >
              <div className={clsx("mb-1 transition-opacity", !u.alive && "opacity-0")}>
                <div className="pixel-bar h-1.5 w-full bg-ink sm:h-2">
                  <div className={clsx("h-full", u.side === "A" ? "bg-lime" : "bg-ember")} style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                </div>
                {u.shield > 0 && <div className="mt-0.5 h-1 bg-ice" style={{ width: `${Math.min(100, (u.shield / 24) * 100)}%` }} />}
              </div>
              <div key={`${u.id}-${u.fx.id}`} className={clsx("origin-bottom", fxClass(u))}>
                <div className={u.alive ? "sprite-idle" : ""}>
                  <FighterSprite spriteKey={u.sprite} role={u.role} flip={u.side === "B"} />
                </div>
              </div>
              <div className="mx-auto mt-0.5 h-1.5 w-3/4 rounded-full bg-black/40" />
            </div>
          ))}

        {/* Floating numbers */}
        {view.texts.map((t) => (
          <span
            key={t.id}
            className={clsx("float-text pointer-events-none absolute z-30 -translate-x-1/2 text-base font-bold uppercase drop-shadow-[2px_2px_0_#1a1c2c] sm:text-2xl", textColor[t.kind])}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            aria-hidden="true"
          >
            {t.text}
          </span>
        ))}

        {/* What just happened, in plain words */}
        <p className="absolute inset-x-0 bottom-0 z-20 bg-ink/80 px-3 py-1.5 text-center text-sm text-paper sm:text-lg" aria-hidden="true">
          {view.log}
        </p>

        {view.winner && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-1 bg-ink/60 text-center" aria-hidden="true">
            <span className="victory text-4xl uppercase text-gold sm:text-6xl">Victory!</span>
            <span className="text-xl uppercase text-paper sm:text-3xl">{teamName[view.winner]} wins</span>
          </div>
        )}
      </div>

      <ul className="grid gap-2 text-base sm:grid-cols-3 sm:text-lg">
        <RoleHint color="bg-sky" label="Tank" text="Takes hits for the team" />
        <RoleHint color="bg-leaf" label="Healer" text="Heals hurt friends" />
        <RoleHint color="bg-ember" label="Damage" text="Hits the enemy hard" />
      </ul>
    </div>
  );
}

function TeamBar({ label, percent, color, reverse }: { label: string; percent: number; color: string; reverse?: boolean }) {
  return (
    <div className={clsx("flex min-w-0 flex-1 flex-col gap-0.5", reverse && "items-end")}>
      <span className="truncate text-xs uppercase text-paper sm:text-base">{label}</span>
      <div className={clsx("pixel-bar h-2 w-full bg-ink sm:h-3", reverse && "flex justify-end")}>
        <div className={clsx("h-full transition-[width] duration-500", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RoleHint({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <li className="flex items-center gap-2 bg-night/70 px-2 py-1.5">
      <span className={clsx("px-2 py-0.5 text-sm uppercase text-ink", color)}>{label}</span>
      <span className="text-steel">{text}</span>
    </li>
  );
}
