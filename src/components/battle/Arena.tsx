"use client";

import clsx from "clsx";
import { ArenaBackdrop } from "@/components/home/ArenaBackdrop";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { BattleView, FloatText, LiveUnit, Side, UnitMeta } from "@/lib/battle";

/** The street in the backdrop starts ~58% of the way down; fighters stand on that band. */
const GROUND_TOP = 58;
const GROUND_HEIGHT = 38;

const toLeft = (x: number, w: number) => (x / w) * 100;
const toTop = (y: number, h: number) => GROUND_TOP + (y / h) * GROUND_HEIGHT;

const textColor: Record<FloatText["kind"], string> = {
  dmg: "text-paper",
  heal: "text-lime",
  shield: "text-ice",
  ko: "text-ember",
  block: "text-steel",
  mod: "text-gold",
};

function fxClass(u: LiveUnit, side: Side) {
  switch (u.fx.kind) {
    case "lunge":
      return side === 1 ? "fx-lunge-r" : "fx-lunge-l";
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
}

const teamHp = (view: BattleView, side: Side) => {
  const team = view.metas.filter((m) => m.side === side);
  const hp = team.reduce((sum, m) => sum + (view.units[m.id]?.hp ?? 0), 0);
  const max = team.reduce((sum, m) => sum + (view.units[m.id]?.maxHp ?? 0), 0);
  return max > 0 ? Math.round((hp / max) * 100) : 0;
};

export function Arena({
  view,
  canFocus,
  onFocus,
}: {
  view: BattleView;
  /** True when the player steers a fighter, so clicking an enemy sets its focus target. */
  canFocus: boolean;
  onFocus: (id: string) => void;
}) {
  const { arena } = view;
  const ordered = view.metas
    .map((m) => ({ meta: m, live: view.units[m.id] }))
    .filter((e): e is { meta: UnitMeta; live: LiveUnit } => !!e.live)
    .sort((a, b) => a.live.y - b.live.y);

  const result = view.end?.result;

  return (
    <div className="pixel-box relative aspect-[3/2] w-full overflow-hidden bg-ink" role="group" aria-label="The arena">
      <ArenaBackdrop />

      {/* Team health */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-ink/70 px-2 py-1.5 sm:gap-4 sm:px-4">
        <TeamBar label="Your team" percent={teamHp(view, 1)} color="bg-sky" />
        <span className="text-lg uppercase text-gold sm:text-2xl">VS</span>
        <TeamBar label="Rivals" percent={teamHp(view, 2)} color="bg-blood" reverse />
      </div>

      {ordered.map(({ meta, live }) => {
        const clickable = canFocus && meta.side === 2 && live.alive;
        const focused = view.focusId === meta.id && live.alive;
        const body = (
          <>
            <div className={clsx("mb-1 transition-opacity", !live.alive && "opacity-0")}>
              {meta.controlled && <span className="mb-0.5 block bg-gold px-1 text-center text-[10px] uppercase leading-tight text-ink sm:text-xs">You</span>}
              <span className="block truncate text-center text-[10px] uppercase leading-tight text-paper drop-shadow-[1px_1px_0_#1a1c2c] sm:text-xs">{meta.name}</span>
              <div className="pixel-bar h-1.5 w-full bg-ink sm:h-2">
                <div
                  className={clsx("h-full transition-[width] duration-200", meta.side === 1 ? "bg-lime" : "bg-ember")}
                  style={{ width: `${(live.hp / live.maxHp) * 100}%` }}
                />
              </div>
              {live.shield > 0 && <div className="mt-0.5 h-1 bg-ice" style={{ width: `${Math.min(100, (live.shield / live.maxHp) * 300)}%` }} />}
            </div>
            {focused && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-gold sm:-top-4">▼</span>}
            <div key={live.fx.n} className={clsx("origin-bottom", fxClass(live, meta.side))}>
              <div className={live.alive ? "sprite-idle" : ""}>
                <FighterSprite spriteKey={meta.spriteKey} role={meta.role} flip={meta.side === 2} />
              </div>
            </div>
            <div className="mx-auto mt-0.5 h-1.5 w-3/4 rounded-full bg-black/40" />
          </>
        );
        const common = {
          className: clsx(
            "absolute w-[12%] min-w-10 -translate-x-1/2 -translate-y-full transition-[left,top] duration-100 ease-linear",
            clickable && "cursor-crosshair",
          ),
          style: { left: `${toLeft(live.x, arena.w)}%`, top: `${toTop(live.y, arena.h)}%`, zIndex: 10 + Math.round(live.y) },
        };
        return clickable ? (
          <div
            key={meta.id}
            {...common}
            role="button"
            tabIndex={0}
            aria-label={`Focus ${meta.name}`}
            onClick={() => onFocus(meta.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onFocus(meta.id)}
          >
            {body}
          </div>
        ) : (
          <div key={meta.id} {...common} aria-label={`${meta.name}, ${live.hp} of ${live.maxHp} health`} role="img">
            {body}
          </div>
        );
      })}

      {view.texts.map((t) => (
        <span
          key={t.id}
          className={clsx(
            "float-text pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full text-base font-bold uppercase drop-shadow-[2px_2px_0_#1a1c2c] sm:text-2xl",
            textColor[t.kind],
          )}
          style={{ left: `${toLeft(t.x, arena.w)}%`, top: `calc(${toTop(t.y, arena.h)}% - 3.5rem)` }}
          aria-hidden="true"
        >
          {t.text}
        </span>
      ))}

      <p className="absolute inset-x-0 bottom-0 z-30 bg-ink/80 px-3 py-1.5 text-center text-sm text-paper sm:text-lg" aria-hidden="true">
        {view.log}
      </p>

      {result && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-1 bg-ink/60 text-center" aria-hidden="true">
          <span className={clsx("victory text-4xl uppercase sm:text-6xl", result === "win" ? "text-gold" : result === "loss" ? "text-ember" : "text-steel")}>
            {result === "win" ? "Victory!" : result === "loss" ? "Defeat" : "Draw"}
          </span>
        </div>
      )}
    </div>
  );
}

function TeamBar({ label, percent, color, reverse }: { label: string; percent: number; color: string; reverse?: boolean }) {
  return (
    <div className={clsx("flex min-w-0 flex-1 flex-col gap-0.5", reverse && "items-end")}>
      <span className="truncate text-xs uppercase text-paper sm:text-base">{label}</span>
      <div className={clsx("pixel-bar h-2 w-full bg-ink sm:h-3", reverse && "flex justify-end")}>
        <div className={clsx("h-full transition-[width] duration-300", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
