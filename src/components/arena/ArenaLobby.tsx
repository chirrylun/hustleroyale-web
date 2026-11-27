"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { BOSSES, RANGES, RAID_STAGES, bossSprite, fmtTime, raidLevel, rangeFor } from "@/lib/arena";
import type { BossId, RangeId, StartRequest } from "@/lib/battle";
import { DAILY_CAP } from "@/lib/economy";
import type { StarterFighter } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";
import { BossBoard } from "./BossBoard";
import { MiniFighter } from "./MiniFighter";

type Mode = "challenge" | "boss" | "raid";
const MODES: { id: Mode; title: string; line: string }[] = [
  { id: "challenge", title: "Challenge", line: "An AI team of your chosen level. Pays practice points." },
  { id: "boss", title: "Boss Rush", line: "Pick a floor boss. Beat it, and race the leaderboard." },
  { id: "raid", title: "Floor Raid", line: "Climb ten floors in one go. Health carries over." },
];

function Pick({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={clsx("pixel-btn text-left", selected ? "bg-gold text-ink" : "bg-panel text-paper", className)}>
      {children}
    </button>
  );
}

/** The arena menu: your team (small cards), the mode, the level range, then what that mode needs. */
export function ArenaLobby({ team, starting, error, capReached, onStart }: { team: StarterFighter[]; starting: boolean; error: string | null; capReached: boolean; onStart: (req: StartRequest) => void }) {
  const avg = Math.round(team.reduce((s, f) => s + f.level, 0) / Math.max(1, team.length));
  const [mode, setMode] = useState<Mode>("challenge");
  const [range, setRange] = useState<RangeId>(() => rangeFor(avg));
  const [boss, setBoss] = useState<BossId | null>(null);
  const [steer, setSteer] = useState<string>("");
  const [mine, setMine] = useState<Record<string, number>>({});
  const def = RANGES.find((r) => r.id === range)!;
  const bossId: BossId = boss && def.bosses.includes(boss) ? boss : def.bosses[0];
  const steerId = steer && team.some((f) => f.id === steer) ? steer : null;

  useEffect(() => {
    let off = false;
    void createClient().rpc("boss_rush_mine").then(({ data }) => {
      if (off) return;
      setMine(Object.fromEntries(((data as { boss: string; range: string; time_ms: number }[] | null) ?? []).map((r) => [`${r.boss}:${r.range}`, r.time_ms])));
    });
    return () => { off = true; };
  }, []);

  const mismatch = useMemo(() => (avg < def.min - 3 ? "Your team is well below this range. Expect a hard fight." : avg > def.max ? "Your team is above this range, so it should be easy." : null), [avg, def]);

  const steerPicker = (
    <label className="flex flex-wrap items-center gap-2 text-lg text-steel">
      Steer a fighter
      <select value={steerId ?? ""} onChange={(e) => setSteer(e.target.value)} className="pixel-btn bg-panel px-2 py-1 text-lg text-paper">
        <option value="">Nobody (coach)</option>
        {team.map((f) => <option key={f.id} value={f.id}>{f.template.name}</option>)}
      </select>
    </label>
  );

  const startLabel = starting ? "Getting the arena ready..." : mode === "challenge" ? "Start challenge" : mode === "boss" ? `Fight ${BOSSES[bossId].name}` : `Start raid, floor 1`;
  const go = () => onStart(mode === "challenge" ? { mode, range } : mode === "boss" ? { mode, range, boss: bossId, controlledFighterId: steerId } : { mode, range, controlledFighterId: steerId });

  return (
    <>
      <PixelPanel title="Your team">
        <div className="grid gap-2 sm:grid-cols-3">{team.map((f) => <MiniFighter key={f.id} fighter={f} />)}</div>
        <p className="mt-2 text-base text-steel">Team level {avg}</p>
      </PixelPanel>

      <div role="group" aria-label="Mode" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <Pick key={m.id} selected={mode === m.id} onClick={() => setMode(m.id)} className="flex flex-col px-3 py-2">
            <span className="text-2xl uppercase leading-tight">{m.title}</span>
            <span className={clsx("text-base leading-tight", mode === m.id ? "text-ink" : "text-steel")}>{m.line}</span>
          </Pick>
        ))}
      </div>

      <PixelPanel title="Level range">
        <div role="group" aria-label="Level range" className="grid grid-cols-3 gap-2">
          {RANGES.map((r) => (
            <Pick key={r.id} selected={range === r.id} onClick={() => setRange(r.id)} className="px-2 py-2 text-center">
              <span className="block text-2xl uppercase">Lv {r.min}-{r.max}</span>
              {mode === "raid" && <span className={clsx("block text-sm", range === r.id ? "text-ink" : "text-steel")}>{r.theme}</span>}
            </Pick>
          ))}
        </div>
        {mismatch && <p className="mt-2 text-base text-gold">{mismatch}</p>}
      </PixelPanel>

      {mode === "challenge" && (
        <PixelPanel title="Challenge">
          <ul className="flex flex-col gap-1 text-lg text-steel">
            <li>You face an AI team of level {def.min} to {def.max}, with the same roles as yours.</li>
            <li>Your team fights on its own: pick Attack, Balanced or Defend during the fight.</li>
            <li>Wins pay practice points: up to {DAILY_CAP} a day, resets at midnight UTC.</li>
          </ul>
        </PixelPanel>
      )}

      {mode === "boss" && (
        <>
          <PixelPanel title="Pick a boss">
            <div className="grid gap-2 sm:grid-cols-2">
              {def.bosses.map((id, i) => {
                const b = BOSSES[id];
                const best = mine[`${id}:${range}`];
                return (
                  <Pick key={id} selected={bossId === id} onClick={() => setBoss(id)} className="flex items-center gap-2 p-2">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-ink" aria-hidden="true"><div className="absolute inset-x-0 -bottom-1 scale-[1.15]"><FighterSprite spriteKey={bossSprite(id)} role={b.role} still /></div></div>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="text-xl uppercase">{b.name}</span>
                      <span className={clsx("text-sm", bossId === id ? "text-ink" : "text-gold")}>Lv {b.level} · Floor {b.floor} boss · {i === 0 ? "Easier" : "Harder"}</span>
                      <span className={clsx("text-sm", bossId === id ? "text-ink" : "text-steel")}>{b.blurb}</span>
                      <span className="text-sm">{best ? `Your best ${fmtTime(best)}` : "Not beaten yet"}</span>
                    </span>
                  </Pick>
                );
              })}
            </div>
          </PixelPanel>
          <PixelPanel title={`Fastest teams: ${BOSSES[bossId].name}, Lv ${def.min}-${def.max}`}>
            <BossBoard boss={bossId} range={range} />
          </PixelPanel>
          <p className="text-base text-steel">No rewards yet. This one is for the leaderboard.</p>
        </>
      )}

      {mode === "raid" && (
        <PixelPanel title={`Floor Raid: ${def.theme}`}>
          <ol className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: RAID_STAGES }, (_, i) => i + 1).map((s) => (
              <li key={s} className={clsx("pixel-box px-1 py-1 text-center leading-tight", s === RAID_STAGES ? "bg-gold text-ink" : "bg-night text-paper")}>
                <span className="block text-sm opacity-80">Floor {s}</span>
                <span className="block text-lg">{s === RAID_STAGES ? "Boss" : `Lv ${raidLevel(def, s)}`}</span>
              </li>
            ))}
          </ol>
          <ul className="mt-2 flex flex-col gap-1 text-lg text-steel">
            <li>All ten floors in one run. The mobs get stronger on every floor, and the tenth floor has {BOSSES[def.bosses[1]].name}.</li>
            <li>Health carries over. Between floors everyone heals a little, and a fallen fighter returns weak.</li>
            <li>If your team falls, the raid ends. No rewards yet.</li>
          </ul>
        </PixelPanel>
      )}

      {mode !== "challenge" && <PixelPanel title="Steering">{steerPicker}<p className="mt-1 text-base text-steel">Steer one fighter yourself: walk it and dodge red circles. Its skills fire on their own.</p></PixelPanel>}

      {error && <p role="alert" className="pixel-box bg-blood px-4 py-3 text-lg text-paper">{error}</p>}
      {mode === "challenge" && capReached && <p className="text-lg text-gold">You hit today&apos;s practice limit. You can still play, but it won&apos;t pay more points today.</p>}

      <PixelButton onClick={go} disabled={starting} className="py-4 text-2xl sm:text-3xl">{startLabel}</PixelButton>
      <Link href="/lobby" className="pixel-btn self-start bg-panel px-4 py-2 text-lg uppercase text-paper">Back to lobby</Link>
    </>
  );
}
