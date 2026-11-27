"use client";

import { Music } from "@/components/Music";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArenaLobby } from "@/components/arena/ArenaLobby";
import { BOSSES, fmtTime } from "@/lib/arena";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { useSoloBattle, type BattleEndPayload, type BattleView, type Stance } from "@/lib/battle";
import { DAILY_CAP } from "@/lib/economy";
import { isMuted, setMuted } from "@/lib/sfx";
import type { StarterFighter } from "@/lib/starter-pack";
import { Arena } from "./Arena";

export type TeamFighter = StarterFighter;

interface Props {
  team: TeamFighter[];
  coins: number;
  /** Practice points already earned today (UTC day). */
  earnedToday: number;
}

export function ArenaScreen({ team, coins: startCoins, earnedToday: startToday }: Props) {
  const { phase, view, error, lastReward, startMode, nextFloor, focus, move, auto, setStance, reset } = useSoloBattle();
  const [muted, setMutedState] = useState(() => isMuted());
  const held = useRef(new Set<string>());

  // After a match pays out, the balance and today's total come straight from the server's answer.
  const coins = lastReward?.balance ?? startCoins;
  const earnedToday = lastReward?.earnedToday ?? startToday;

  const controlledUnit = view?.controlledUnitId ?? null;
  // Keyboard: WASD or the arrow keys walk, Space hands the fighter back to its AI.
  const liveRef = useRef(view);
  useEffect(() => {
    liveRef.current = view;
  });
  useEffect(() => {
    if (phase !== "fighting" || !controlledUnit) return;
    const keys = held.current;
    keys.clear();
    const DIRS: Record<string, [number, number]> = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k in DIRS) {
        keys.add(k);
        e.preventDefault();
        return;
      }
      if (k === " ") {
        e.preventDefault();
        auto();
        return;
      }
    };
    const onUp = (e: KeyboardEvent) => void keys.delete(e.key.toLowerCase());
    const walk = setInterval(() => {
      const v = liveRef.current;
      const me = v?.units[controlledUnit];
      if (!v || !me?.alive || keys.size === 0) return;
      let dx = 0;
      let dy = 0;
      for (const k of keys) {
        dx += DIRS[k][0];
        dy += DIRS[k][1];
      }
      if (dx === 0 && dy === 0) return;
      const len = Math.hypot(dx, dy);
      // Aim a few steps ahead of the fighter, so holding a key keeps it walking that way.
      move(Math.min(v.arena.w, Math.max(0, me.x + (dx / len) * 4)), Math.min(v.arena.h, Math.max(0, me.y + (dy / len) * 4)));
    }, 80);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      clearInterval(walk);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      keys.clear();
    };
  }, [phase, controlledUnit, move, auto]);

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
      <Music track="arena" />
      <div className="flex flex-wrap gap-2 text-lg">
        <Chip label="Points" value={coins} />
        <Chip label="Practice points today" value={`${earnedToday} / ${DAILY_CAP}`} />
      </div>

      {showArena ? (
        <>
          {view.info && <FightHeader info={view.info} />}
          <Arena view={view} phase={phase} canFocus={!!controlledUnit && phase === "fighting"} canMove={!!controlledUnit && phase === "fighting" && !view.end} onFocus={focus} onMove={move} />
          <div className="flex justify-end">
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
              }}
              className="pixel-btn bg-panel px-3 py-1 text-base uppercase text-paper"
            >
              Sound: {muted ? "off" : "on"}
            </button>
          </div>
          {phase === "fighting" && (controlledUnit ? <SkillBar view={view} onAuto={auto} /> : <StanceBar current={view.stances[1]} onPick={setStance} />)}
          {phase === "ended" && view.end && <ResultPanel end={view.end} coins={coins} earnedToday={earnedToday} onAgain={reset} onNext={nextFloor} />}
        </>
      ) : phase === "starting" && view?.info?.mode === "raid" ? (
        <PixelPanel title="Next floor"><p className="text-xl text-paper" aria-live="polite">Getting the next floor ready...</p></PixelPanel>
      ) : (
        <ArenaLobby team={team} starting={phase === "starting"} error={error} capReached={earnedToday >= DAILY_CAP} onStart={startMode} />
      )}
    </div>
  );
}

/** The mode, boss or floor being fought, above the arena. */
function FightHeader({ info }: { info: NonNullable<BattleView["info"]> }) {
  return (
    <div className="pixel-box flex flex-wrap items-center justify-between gap-2 bg-night px-3 py-2">
      <div className="leading-tight">
        <p className="text-2xl uppercase text-gold">{info.title}</p>
        {info.subtitle && <p className="text-base text-steel">{info.subtitle}</p>}
      </div>
      {info.mode === "raid" && info.stage && info.stages && (
        <ol className="flex gap-1" aria-label={`Floor ${info.stage} of ${info.stages}`}>
          {Array.from({ length: info.stages }, (_, i) => i + 1).map((s) => <li key={s} className={clsx("h-3 w-3", s < info.stage! ? "bg-leaf" : s === info.stage ? "bg-gold" : "bg-panel")} />)}
        </ol>
      )}
    </div>
  );
}

function Choice({ selected, onClick, title, hint, icon }: { selected: boolean; onClick: () => void; title: string; hint: string; icon?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx("pixel-btn flex cursor-pointer items-center gap-3 px-3 py-2 text-left", selected ? "bg-gold text-ink" : "bg-panel text-paper")}
    >
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-10 w-10 shrink-0 [image-rendering:pixelated]" draggable={false} />
      )}
      <span className="flex min-w-0 flex-col items-start">
        <span className="text-xl uppercase leading-tight">{title}</span>
        <span className={clsx("text-base leading-tight", selected ? "text-ink" : "text-steel")}>{hint}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ in the fight */

function SkillBar({ view, onAuto }: { view: BattleView; onAuto: () => void }) {
  const meta = view.metas.find((m) => m.id === view.controlledUnitId);
  const live = meta ? view.units[meta.id] : undefined;
  if (!meta || !live) return null;

  return (
    <PixelPanel title={`Steering ${meta.name}`}>
      <p className="text-lg text-paper">Skills fire on their own when they&apos;re ready. You decide where your fighter stands.</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-base uppercase text-steel">Energy</span>
        <div className="pixel-bar h-3 flex-1 bg-ink">
          <div className="h-full bg-sky transition-[width] duration-300" style={{ width: `${(live.energy / live.maxEnergy) * 100}%` }} />
        </div>
      </div>
      <p className="mt-2 text-base text-steel">
        Tap the ground or use WASD to walk. Tap a rival to focus on it. Big attacks show a red circle: step out of it before it fills!
      </p>
      <button type="button" onClick={onAuto} className="pixel-btn mt-2 bg-panel px-3 py-1 text-base uppercase text-paper">
        Let the AI move me (Space)
      </button>
    </PixelPanel>
  );
}

const STANCES: { id: Stance; label: string; hint: string }[] = [
  { id: "offensive", label: "Attack", hint: "Chase and hit hard" },
  { id: "neutral", label: "Balanced", hint: "A bit of both" },
  { id: "defensive", label: "Defend", hint: "Hold back and heal early" },
];

export function StanceBar({ current, onPick }: { current: Stance; onPick: (s: Stance) => void }) {
  return (
    <PixelPanel title="Tell your team what to do">
      <div className="grid gap-2 sm:grid-cols-3">
        {STANCES.map((s) => (
          <Choice
            key={s.id} selected={current === s.id} onClick={() => onPick(s.id)} title={s.label} hint={s.hint}
            icon={`/ui/stance-${{ offensive: "attack", neutral: "balanced", defensive: "defend" }[s.id]}.png`}
          />
        ))}
      </div>
    </PixelPanel>
  );
}

/* ------------------------------------------------------------------ result */

function ResultPanel({ end, coins, earnedToday, onAgain, onNext }: { end: BattleEndPayload; coins: number; earnedToday: number; onAgain: () => void; onNext: () => void }) {
  const { reward, arena } = end;
  const won = end.result === "win";
  const back = <Link href="/home" className="pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper">Back to home</Link>;

  if (arena?.mode === "boss") {
    const br = arena.bossRush;
    return (
      <PixelPanel title={won ? `${BOSSES[arena.boss!].name} defeated!` : "The boss won this time"} aria-live="polite">
        {won && br ? (
          <>
            <p className="text-3xl text-gold">{fmtTime(br.timeMs)}</p>
            <p className="mt-1 text-lg text-paper">{br.newBest ? `New best! You are number ${br.rank} on the board.` : `Your best is ${fmtTime(br.bestMs)} (number ${br.rank}).`}</p>
          </>
        ) : (
          <p className="text-lg text-steel">{end.result === "draw" ? "Time ran out." : "Your team fell."} Try a different stance, or steer a fighter out of the red circles.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3"><PixelButton onClick={onAgain}>Back to the arena</PixelButton>{back}</div>
      </PixelPanel>
    );
  }

  if (arena?.mode === "raid") {
    const { stage = 1, stages = 10, cleared = 0, more } = arena;
    const title = !won ? `Your team fell on floor ${stage}` : more ? `Floor ${stage} cleared!` : "Raid cleared!";
    return (
      <PixelPanel title={title} aria-live="polite">
        <p className="text-3xl text-gold">{cleared} / {stages} floors</p>
        <p className="mt-1 text-lg text-steel">
          {more ? "Your team heals a little before the next floor. Fallen fighters return weak." : won ? "You climbed every floor. Well done." : "The raid ends here. Nothing is lost, and no rewards were on offer."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {more ? <PixelButton onClick={onNext}>Next floor</PixelButton> : <PixelButton onClick={onAgain}>Back to the arena</PixelButton>}
          {more ? <button type="button" onClick={onAgain} className="pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper">Leave the raid</button> : back}
        </div>
      </PixelPanel>
    );
  }

  const title = won ? "You won!" : end.result === "loss" ? "You lost this one" : "It was a draw";
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
        {back}
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
