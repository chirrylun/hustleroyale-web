"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArenaBackdrop } from "@/components/home/ArenaBackdrop";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { FxSprite } from "@/components/sprites/FxSprite";
import type { BattleView, Effect, FloatText, LiveUnit, Phase, Side, UnitMeta } from "@/lib/battle";

/** The street in the backdrop starts ~58% of the way down; fighters stand on that band. */
const GROUND_TOP = 58;
const GROUND_HEIGHT = 38;
/** Must match UNIT_RADIUS on the server: a fighter is drawn exactly as wide as it collides. */
const UNIT_RADIUS = 1.2;
const REGULAR_WARNING_MS = 10_000;

const toLeft = (x: number, w: number) => (x / w) * 100;
const toTop = (y: number, h: number) => GROUND_TOP + (y / h) * GROUND_HEIGHT;
/** A circle of `r` arena units becomes an ellipse on screen because the street is drawn in perspective. */
const ellipse = (r: number, arena: { w: number; h: number }): CSSProperties => ({
  width: `${((2 * r) / arena.w) * 100}%`,
  height: `${((2 * r) / arena.h) * GROUND_HEIGHT}%`,
});

const textColor: Record<FloatText["kind"], string> = {
  dmg: "text-paper",
  heal: "text-lime",
  shield: "text-ice",
  ko: "text-ember",
  block: "text-steel",
  mod: "text-gold",
  crit: "text-gold",
  weak: "text-steel",
  stun: "text-ice",
};

const ACTION: Record<string, "attack" | "cast" | "hurt"> = { lunge: "attack", cast: "cast", hurt: "hurt" };

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
    case "cast":
      return "fx-cast";
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

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Arena({
  view,
  phase,
  canFocus,
  canMove,
  onFocus,
  onMove,
}: {
  view: BattleView;
  phase: Phase;
  /** True when the player steers a fighter, so clicking an enemy sets its focus target. */
  canFocus: boolean;
  /** True when clicking the ground should walk the controlled fighter there. */
  canMove: boolean;
  onFocus: (id: string) => void;
  /** Arena units, already clamped to the arena. */
  onMove: (x: number, y: number) => void;
}) {
  const { arena } = view;
  const root = useRef<HTMLDivElement>(null);
  const [stopped, setStopped] = useState(false);
  const [marker, setMarker] = useState<{ x: number; y: number; n: number } | null>(null);
  const ordered = view.metas
    .map((m) => ({ meta: m, live: view.units[m.id] }))
    .filter((e): e is { meta: UnitMeta; live: LiveUnit } => !!e.live)
    .sort((a, b) => a.live.y - b.live.y);

  const finale = !!view.end && phase === "fighting";
  const result = phase === "ended" ? view.end?.result : undefined;
  const finalUnit = view.finalBlowId ? view.units[view.finalBlowId] : undefined;

  // Screen shake: big hits and explosions rattle the whole arena.
  useEffect(() => {
    if (!view.shake.n || !root.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const px = view.shake.power * 3;
    root.current.animate(
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${-px}px, ${px / 2}px)` },
        { transform: `translate(${px}px, ${-px / 2}px)` },
        { transform: `translate(${-px / 2}px, ${px / 3}px)` },
        { transform: "translate(0,0)" },
      ],
      { duration: 120 + view.shake.power * 70, easing: "steps(5)" },
    );
  }, [view.shake.n, view.shake.power]);

  // A knockout freezes the picture for a moment so it lands.
  useEffect(() => {
    if (!view.hitStop) return;
    const on = setTimeout(() => setStopped(true), 0);
    const off = setTimeout(() => setStopped(false), 130);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [view.hitStop]);

  useEffect(() => {
    if (!marker) return;
    const t = setTimeout(() => setMarker(null), 650);
    return () => clearTimeout(t);
  }, [marker]);

  const ground = (e: PointerEvent<HTMLDivElement>) => {
    if (!canMove || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.min(arena.w, Math.max(0, fx * arena.w));
    const y = Math.min(arena.h, Math.max(0, ((fy - GROUND_TOP) / GROUND_HEIGHT) * arena.h));
    setMarker({ x, y, n: (marker?.n ?? 0) + 1 });
    onMove(x, y);
  };

  const sinceSudden = view.suddenAt === null ? 0 : view.timeMs - view.suddenAt;
  const ringProgress = Math.min(1, sinceSudden / view.clock.shrinkMs);
  const startRing = Math.hypot(arena.w / 2, arena.h / 2) + 1;
  const ringR = startRing + (view.clock.minRadius - startRing) * ringProgress;
  const remaining = view.clock.regularMs - view.timeMs;
  const sudden = view.phase === "sudden";

  return (
    <div
      ref={root}
      className={clsx("pixel-box relative aspect-[3/2] w-full touch-manipulation select-none overflow-hidden bg-ink", stopped && "arena-hitstop", canMove && "cursor-pointer")}
      role="group"
      aria-label="The arena"
      onPointerDown={ground}
    >
      <div
        className={clsx("absolute inset-0 [container-type:size] transition-transform ease-out", finale ? "duration-[1400ms]" : "duration-300")}
        style={
          finale && finalUnit
            ? { transform: "scale(1.45)", transformOrigin: `${toLeft(finalUnit.x, arena.w)}% ${toTop(finalUnit.y, arena.h) - 8}%` }
            : undefined
        }
      >
        <ArenaBackdrop />

        {view.obstacles.map((o) => (
          <Obstacle key={o.id} o={o} arena={arena} />
        ))}

        {sudden && (
          <div
            className="pointer-events-none absolute left-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-ember transition-[width,height] duration-1000 ease-linear"
            style={{ ...ellipse(ringR, arena), top: `${toTop(arena.h / 2, arena.h)}%`, boxShadow: "0 0 0 100vmax rgba(177,62,83,0.38), inset 0 0 18px rgba(239,125,87,0.6)" }}
            aria-hidden="true"
          />
        )}

        {view.effects.map((f) => (
          <EffectView key={f.id} f={f} arena={arena} />
        ))}

        {marker && (
          <span
            key={marker.n}
            className="move-marker pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-gold"
            style={{ left: `${toLeft(marker.x, arena.w)}%`, top: `${toTop(marker.y, arena.h)}%`, ...ellipse(0.9, arena) }}
            aria-hidden="true"
          />
        )}

        {ordered.map(({ meta, live }) => {
          const clickable = canFocus && meta.side === 2 && live.alive;
          const focused = view.focusId === meta.id && live.alive;
          const stunned = live.alive && view.timeMs < live.stunUntil;
          const charging = live.alive && view.timeMs < live.windupUntil;
          const walking = live.alive && !stunned && !charging && view.timeMs < live.walkUntil;
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
              <div className={clsx("origin-bottom", fxClass(live, meta.side))} key={live.fx.n}>
                <div className={clsx(live.alive && charging && !stunned && "sprite-charge", stunned && "sprite-stunned")}>
                  <FighterSprite
                    spriteKey={meta.spriteKey}
                    role={meta.role}
                    flip={meta.side === 2}
                    rest={stunned ? "stun" : charging ? "windup" : walking ? "walk" : "idle"}
                    action={live.alive ? ACTION[live.fx.kind ?? ""] ?? null : null}
                    actionKey={live.fx.n}
                    tempo={0.8 + Math.min(meta.spd, 100) / 200}
                    className="-mb-[10%]"
                  />
                </div>
              </div>
              <div className={clsx("mx-auto mt-0.5 h-1.5 w-3/4 rounded-full", meta.controlled ? "bg-gold/70" : "bg-black/40")} />
            </>
          );
          const common = {
            className: clsx(
              "absolute left-0 top-0 will-change-transform ease-linear",
              finale ? "transition-transform duration-500" : "transition-transform duration-[110ms]",
              clickable && "cursor-crosshair",
            ),
            style: {
              transform: `translate3d(calc(${toLeft(live.x, arena.w)}cqw - 50%), calc(${toTop(live.y, arena.h)}cqh - 100%), 0)`,
              width: `${((2 * UNIT_RADIUS * 2.9) / arena.w) * 100}%`,
              minWidth: "5rem",
              zIndex: 10 + Math.round(live.y),
            },
          };
          return clickable ? (
            <div
              key={meta.id}
              {...common}
              role="button"
              tabIndex={0}
              aria-label={`Focus ${meta.name}`}
              onPointerDown={(e) => e.stopPropagation()}
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
              "float-text pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full font-bold uppercase drop-shadow-[2px_2px_0_#1a1c2c]",
              t.kind === "crit" ? "text-xl sm:text-3xl" : "text-base sm:text-2xl",
              textColor[t.kind],
            )}
            style={{ left: `${toLeft(t.x, arena.w)}%`, top: `calc(${toTop(t.y, arena.h)}% - 3.5rem)` }}
            aria-hidden="true"
          >
            {t.text}
          </span>
        ))}
      </div>

      {finale && <div className="pointer-events-none absolute inset-0 z-[45] bg-ink/25" aria-hidden="true" />}

      {/* Team health and the match clock */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-ink/70 px-2 py-1.5 sm:gap-4 sm:px-4">
        <TeamBar label="Your team" percent={teamHp(view, 1)} color="bg-sky" />
        <div className="flex flex-col items-center leading-none">
          <span className="text-lg uppercase text-gold sm:text-2xl">VS</span>
          <span
            className={clsx("text-xs sm:text-base", sudden ? "sudden-pulse text-ember" : remaining <= REGULAR_WARNING_MS ? "sudden-pulse text-gold" : "text-steel")}
            aria-label={sudden ? "Sudden death" : `${clock(remaining)} until sudden death`}
          >
            {sudden ? "SUDDEN DEATH" : clock(remaining)}
          </span>
        </div>
        <TeamBar label="Rivals" percent={teamHp(view, 2)} color="bg-blood" reverse />
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-ink/80 px-3 py-1.5 text-center text-sm text-paper sm:text-lg" aria-hidden="true">
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

function Obstacle({ o, arena }: { o: BattleView["obstacles"][number]; arena: { w: number; h: number } }) {
  const foot = ellipse(o.r, arena);
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${toLeft(o.x, arena.w)}%`, top: `${toTop(o.y, arena.h)}%`, width: foot.width, height: foot.height, zIndex: 10 + Math.round(o.y) }}
      aria-hidden="true"
    >
      {/* The footprint is exactly the area fighters can't walk through. */}
      <div className="absolute inset-0 rounded-[50%] bg-black/45" />
      {o.kind === "pillar" ? (
        <div className="absolute bottom-1/2 left-1/2 flex h-[260%] w-[70%] -translate-x-1/2 translate-y-1/3 flex-col border-2 border-ink bg-steel">
          <div className="h-[16%] bg-paper" />
          <div className="flex-1 bg-[repeating-linear-gradient(90deg,#94b0c2_0_30%,#566c86_30%_40%)]" />
          <div className="h-[12%] bg-mist" />
        </div>
      ) : (
        <div className="absolute bottom-1/2 left-1/2 flex h-[220%] w-[90%] -translate-x-1/2 translate-y-1/3 flex-col border-2 border-ink">
          <div className="h-[36%] bg-[repeating-linear-gradient(90deg,#b13e53_0_25%,#f4f4f4_25%_50%)]" />
          <div className="flex-1 bg-[#6b4423]" />
        </div>
      )}
    </div>
  );
}

function EffectView({ f, arena }: { f: Effect; arena: { w: number; h: number } }) {
  const color = f.tone === "magical" ? "rgba(65,166,246,0.9)" : f.tone === "heal" ? "rgba(167,240,112,0.95)" : "rgba(244,244,244,0.95)";
  if (f.kind === "vfx" && f.fx) {
    const stars = f.fx.sheet === "shared" && f.fx.row === 1; // stun stars circle the head, not the body
    return (
      <FxSprite
        sheet={f.fx.sheet}
        row={f.fx.row}
        ms={stars ? 700 : f.durationMs}
        loop={f.fx.loop}
        className="pointer-events-none absolute z-[41] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${toLeft(f.x, arena.w)}%`,
          top: `${toTop(f.y, arena.h) - ((stars ? 4.6 : 2.4) / arena.h) * 100}%`,
          width: `${((stars ? 3.6 : 7) / arena.w) * 100}%`,
          minWidth: stars ? "2.5rem" : "4rem",
        }}
      />
    );
  }
  if (f.kind === "zone") {
    return (
      <div
        className="danger-zone pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[50%] border-2 border-ember bg-ember/25"
        style={{ left: `${toLeft(f.x, arena.w)}%`, top: `${toTop(f.y, arena.h)}%`, ...ellipse(f.radius, arena) }}
        aria-hidden="true"
      >
        <div className="danger-zone-fill h-full w-full rounded-[50%] bg-ember/60" style={{ animationDuration: `${f.durationMs}ms` }} />
        <FxSprite sheet="shared" row={3} ms={700} loop className="absolute inset-0" style={{ aspectRatio: "auto", width: "100%", height: "100%", backgroundSize: "600% 600%" }} />
      </div>
    );
  }
  if (f.kind === "burst") {
    return (
      <div
        className="burst pointer-events-none absolute z-[41] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-gold bg-paper/70"
        style={{ left: `${toLeft(f.x, arena.w)}%`, top: `${toTop(f.y, arena.h)}%`, ...ellipse(f.radius, arena) }}
        aria-hidden="true"
      />
    );
  }
  const shotStyle = {
    animationDuration: `${f.durationMs}ms`,
    "--x1": `${toLeft(f.x, arena.w)}%`,
    "--y1": `calc(${toTop(f.y, arena.h)}% - 2.2rem)`,
    "--x2": `${toLeft(f.x2, arena.w)}%`,
    "--y2": `calc(${toTop(f.y2, arena.h)}% - 2.2rem)`,
  } as CSSProperties;
  if (f.fx) {
    return (
      <span className="shot pointer-events-none absolute z-[42] block -translate-x-1/2 -translate-y-1/2" style={{ ...shotStyle, width: `${(3.6 / arena.w) * 100}%`, minWidth: "2.5rem" }} aria-hidden="true">
        <FxSprite sheet={f.fx.sheet} row={f.fx.row} ms={420} loop style={{ width: "100%", transform: f.x2 < f.x ? "scaleX(-1)" : undefined }} />
      </span>
    );
  }
  return (
    <span
      className="shot pointer-events-none absolute z-[42] block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink sm:size-4"
      style={{ ...shotStyle, background: color, boxShadow: `0 0 8px ${color}` } as CSSProperties}
      aria-hidden="true"
    />
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
