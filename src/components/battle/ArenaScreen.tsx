"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FighterCard } from "@/components/pack/FighterCard";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { useSoloBattle, type BattleEndPayload, type BattleView, type Difficulty, type Stance } from "@/lib/battle";
import { DAILY_CAP, DIFFICULTY_INFO } from "@/lib/economy";
import type { StarterFighter } from "@/lib/starter-pack";
import { Arena } from "./Arena";

export type TeamFighter = StarterFighter;

interface Props {
  team: TeamFighter[];
  coins: number;
  /** Practice points already earned today (UTC day). */
  earnedToday: number;
}

const DIFFICULTIES: Difficulty[] = ["rookie", "hustler", "boss"];

export function ArenaScreen({ team, coins: startCoins, earnedToday: startToday }: Props) {
  const { phase, view, error, lastReward, start, cast, focus, setStance, reset } = useSoloBattle();
  const [difficulty, setDifficulty] = useState<Difficulty>("hustler");
  const [controlledId, setControlledId] = useState<string | null>(null);

  // After a match pays out, the balance and today's total come straight from the server's answer.
  const coins = lastReward?.balance ?? startCoins;
  const earnedToday = lastReward?.earnedToday ?? startToday;

  const controlledUnit = view?.controlledUnitId ?? null;
  useEffect(() => {
    if (phase !== "fighting" || !view || !controlledUnit) return;
    const meta = view.metas.find((m) => m.id === controlledUnit);
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key);
      if (Number.isInteger(index) && index >= 1 && meta?.skills[index]) cast(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, view, controlledUnit, cast]);

  if (team.length === 0) {
    return (
      <PixelPanel title="No team yet">
        <p className="text-xl text-paper">You need fighters on your team before you can fight.</p>
        <Link href="/home" className="pixel-btn mt-4 inline-block bg-leaf px-4 py-2 text-lg uppercase text-ink">
          Back to home
        </Link>
      </PixelPanel>
    );
  }

  const showArena = (phase === "fighting" || phase === "ended") && view;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-lg">
        <Chip label="Points" value={coins} />
        <Chip label="Practice points today" value={`${earnedToday} / ${DAILY_CAP}`} />
      </div>

      {showArena ? (
        <>
          <Arena view={view} canFocus={!!controlledUnit && phase === "fighting"} onFocus={focus} />
          {phase === "fighting" && (controlledUnit ? <SkillBar view={view} onCast={cast} /> : <StanceBar current={view.stances[1]} onPick={setStance} />)}
          {phase === "ended" && view.end && <ResultPanel end={view.end} coins={coins} earnedToday={earnedToday} onAgain={reset} />}
        </>
      ) : (
        <Lobby
          team={team}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          controlledId={controlledId}
          onControlled={setControlledId}
          starting={phase === "starting"}
          error={error}
          capReached={earnedToday >= DAILY_CAP}
          onStart={() => start(difficulty, controlledId)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ lobby */

function Lobby({
  team,
  difficulty,
  onDifficulty,
  controlledId,
  onControlled,
  starting,
  error,
  capReached,
  onStart,
}: {
  team: TeamFighter[];
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  controlledId: string | null;
  onControlled: (id: string | null) => void;
  starting: boolean;
  error: string | null;
  capReached: boolean;
  onStart: () => void;
}) {
  return (
    <>
      <PixelPanel title="Your team">
        <div className="grid gap-4 sm:grid-cols-3">
          {team.map((f, i) => (
            <FighterCard key={f.id} fighter={f} delayMs={i * 120} />
          ))}
        </div>
      </PixelPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <PixelPanel title="Who do you control?">
          <div className="flex flex-col gap-2">
            <Choice selected={controlledId === null} onClick={() => onControlled(null)} title="Nobody, I'm the coach" hint="Your team fights on its own. You pick how bold it is." />
            {team.map((f) => (
              <Choice
                key={f.id}
                selected={controlledId === f.id}
                onClick={() => onControlled(f.id)}
                title={f.template.name}
                hint="You choose when to use its special moves."
              />
            ))}
          </div>
        </PixelPanel>

        <PixelPanel title="How hard?">
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((d) => (
              <Choice
                key={d}
                selected={difficulty === d}
                onClick={() => onDifficulty(d)}
                title={DIFFICULTY_INFO[d].label}
                hint={`${DIFFICULTY_INFO[d].hint}. Win: ${DIFFICULTY_INFO[d].win} points.`}
              />
            ))}
          </div>
        </PixelPanel>
      </div>

      <PixelPanel title="About practice points">
        <ul className="flex flex-col gap-1 text-lg text-steel">
          <li>Practice wins pay a few points. The first 5 matches each day pay the most.</li>
          <li>You can earn up to {DAILY_CAP} practice points a day. It resets at midnight UTC.</li>
          <li>Practice never changes your score or your wins and losses. Online matches are for that, and they are coming soon.</li>
        </ul>
      </PixelPanel>

      {error && (
        <p role="alert" className="pixel-box bg-blood px-4 py-3 text-lg text-paper">
          {error}
        </p>
      )}
      {capReached && <p className="text-lg text-gold">You hit today&apos;s practice limit. You can still play, but matches won&apos;t pay more points today.</p>}

      <PixelButton onClick={onStart} disabled={starting} className="py-4 text-2xl sm:text-3xl">
        {starting ? "Getting the arena ready..." : "Start practice match"}
      </PixelButton>
    </>
  );
}

function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx("pixel-btn flex cursor-pointer flex-col items-start px-3 py-2 text-left", selected ? "bg-gold text-ink" : "bg-panel text-paper")}
    >
      <span className="text-xl uppercase leading-tight">{title}</span>
      <span className={clsx("text-base leading-tight", selected ? "text-ink" : "text-steel")}>{hint}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ in the fight */

function SkillBar({ view, onCast }: { view: BattleView; onCast: (index: number) => void }) {
  const meta = view.metas.find((m) => m.id === view.controlledUnitId);
  const live = meta ? view.units[meta.id] : undefined;
  if (!meta || !live) return null;
  const specials = meta.skills.filter((s) => s.index >= 1);

  return (
    <PixelPanel title={`${meta.name}'s moves`}>
      <div className="grid gap-2 sm:grid-cols-3">
        {specials.map((s) => {
          const wait = Math.max(0, (live.cooldownEnds[s.index] ?? 0) - view.timeMs);
          const tired = live.energy < s.staminaCost;
          return (
            <button
              key={s.index}
              type="button"
              disabled={!live.alive}
              onClick={() => onCast(s.index)}
              title="If it isn't ready yet, it fires as soon as it is."
              className={clsx("pixel-btn flex cursor-pointer flex-col items-start px-3 py-2 text-left text-paper", wait > 0 || tired ? "bg-panel opacity-70" : "bg-leaf text-ink")}
            >
              <span className="text-xl uppercase leading-tight">
                {s.index}. {s.name}
              </span>
              <span className="text-base leading-tight">
                {wait > 0 ? `Ready in ${(wait / 1000).toFixed(1)}s` : tired ? "Not enough energy" : "Ready"} · Energy {s.staminaCost}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-base uppercase text-steel">Energy</span>
        <div className="pixel-bar h-3 flex-1 bg-ink">
          <div className="h-full bg-sky transition-[width] duration-300" style={{ width: `${(live.energy / live.maxEnergy) * 100}%` }} />
        </div>
      </div>
      <p className="mt-2 text-base text-steel">Basic attacks happen on their own. Press 1, 2 or 3, or tap a move. Tap a rival to focus on it.</p>
    </PixelPanel>
  );
}

const STANCES: { id: Stance; label: string; hint: string }[] = [
  { id: "offensive", label: "Attack", hint: "Chase and hit hard" },
  { id: "neutral", label: "Balanced", hint: "A bit of both" },
  { id: "defensive", label: "Defend", hint: "Hold back and heal early" },
];

function StanceBar({ current, onPick }: { current: Stance; onPick: (s: Stance) => void }) {
  return (
    <PixelPanel title="Tell your team what to do">
      <div className="grid gap-2 sm:grid-cols-3">
        {STANCES.map((s) => (
          <Choice key={s.id} selected={current === s.id} onClick={() => onPick(s.id)} title={s.label} hint={s.hint} />
        ))}
      </div>
    </PixelPanel>
  );
}

/* ------------------------------------------------------------------ result */

function ResultPanel({ end, coins, earnedToday, onAgain }: { end: BattleEndPayload; coins: number; earnedToday: number; onAgain: () => void }) {
  const { reward } = end;
  const title = end.result === "win" ? "You won!" : end.result === "loss" ? "You lost this one" : "It was a draw";

  let note = "";
  if (reward) {
    if (reward.coinsEarned === 0 && reward.base === 0) note = "No points this time. Practice pays for wins and for real fights.";
    else if (reward.coinsEarned === 0 || reward.capped) note = `You hit today's practice limit of ${reward.dailyCap} points. Come back tomorrow for more.`;
    else if (reward.multiplier < 1) note = "Matches pay a bit less after your first few each day.";
  }

  return (
    <PixelPanel title={title} aria-live="polite">
      {reward ? (
        <p className="text-3xl text-gold">+{reward.coinsEarned} points</p>
      ) : (
        <p className="text-xl text-ember">We couldn&apos;t save the points for this match.</p>
      )}
      {note && <p className="mt-1 text-lg text-steel">{note}</p>}
      <p className="mt-2 text-lg text-paper">
        You now have {coins} points. Practice points today: {earnedToday} / {DAILY_CAP}.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <PixelButton onClick={onAgain}>Fight again</PixelButton>
        <Link href="/home" className="pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper">
          Back to home
        </Link>
      </div>
    </PixelPanel>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pixel-box bg-night px-3 py-1">
      <dt className="text-sm text-steel">{label}</dt>
      <dd className="text-xl text-paper">{value}</dd>
    </div>
  );
}
