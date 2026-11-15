import { modArt, shotArt } from "@/lib/battle";
import { FX_COLS, FX_ROWS, type FxSheet } from "@/lib/sprites/designs";
import type { SkillRef } from "@/lib/starter-pack";

/**
 * Skills on the adventure floors. The arena runs them on the server and plays them from battle events; the
 * floor runs in the browser, so this file turns an equipped skill into the numbers the floor loop needs, and
 * draws the same effect art the arena uses (projectiles, support effects, burst rings) on the map.
 */

export type Fx = { sheet: FxSheet; row: number };
export type Stat = "atk" | "def" | "spd";
export interface Mod { stat: Stat; pct: number }
export type Role = "tank" | "healer" | "dps";

export interface FloorSkill {
  name: string;
  kind: "damage" | "heal" | "shield" | "buff" | "debuff";
  magical: boolean;
  /** Multiplies the floor's normal hit (damage) or the fighter's magic (heal, shield). */
  power: number;
  /** Seconds. */
  cooldown: number;
  /** Tiles from the caster. 0 means "no limit": the whole squad or the area around it. */
  reach: number;
  melee: boolean;
  target: string;
  radius: number;
  stunMs: number;
  mods: Mod[];
  durationMs: number;
  cleanse: boolean;
  lifesteal: number;
  bonusLowHp: { pct: number; below: number } | null;
  dot: { power: number; durationMs: number; intervalMs: number } | null;
  hot: { power: number; durationMs: number; intervalMs: number } | null;
  /** False for skills that need arena mechanics the floor does not have (summons, dodges, taunts, pulls). */
  supported: boolean;
}

/** Arena skills with a range up to this are melee, as in the arena. */
const MELEE_RANGE = 3;
/** The arena's units are close to a floor tile, but fights there start further apart, so ranges are tightened. */
export const MELEE_REACH = 1.2;
export const reachTiles = (range: number) => (range <= 0 ? 0 : range <= MELEE_RANGE ? MELEE_REACH : Math.min(5.5, MELEE_REACH + range * 0.5));

/** How long a projectile takes to fly, as in the arena. */
export const SHOT_MS = 260;

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const tick = (v: unknown) => {
  const o = v as { power?: unknown; duration_ms?: unknown; interval_ms?: unknown } | null | undefined;
  return o && typeof o === "object" ? { power: num(o.power), durationMs: num(o.duration_ms), intervalMs: Math.max(250, num(o.interval_ms, 1000)) } : null;
};

export function floorSkillOf(s: SkillRef): FloorSkill | null {
  if (!s.name || !s.kind) return null;
  const e = (s.effect ?? {}) as Record<string, unknown>;
  const mods: Mod[] = [];
  const add = (m: { stat?: unknown; pct?: unknown }) => {
    if ((m.stat === "atk" || m.stat === "def" || m.stat === "spd") && typeof m.pct === "number") mods.push({ stat: m.stat, pct: m.pct });
  };
  if (Array.isArray(e.mods)) e.mods.forEach((m) => add(m as { stat?: unknown; pct?: unknown }));
  if (e.stat !== undefined) add(e as { stat?: unknown; pct?: unknown });
  const power = s.power ?? 1;
  const hot = tick(e.hot);
  const bonus = e.bonus_low_hp as { pct?: unknown; below?: unknown } | undefined;
  const needsArena = e.summon !== undefined || e.evade_ms !== undefined || e.taunt_ms !== undefined || e.pull !== undefined;
  const empty = (s.kind === "buff" || s.kind === "debuff") && !mods.length;
  const noHeal = s.kind === "heal" && power <= 0 && !hot;
  return {
    name: s.name, kind: s.kind, magical: s.damageType === "magical", power,
    cooldown: (s.cooldownMs ?? 900) / 1000, reach: reachTiles(s.range ?? 2), melee: (s.range ?? 2) <= MELEE_RANGE,
    target: s.target ?? "enemy_nearest", radius: num(e.radius) * 0.9, stunMs: num(e.stun_ms), mods, durationMs: num(e.duration_ms, 5000),
    cleanse: e.cleanse === true, lifesteal: num(e.lifesteal),
    bonusLowHp: bonus && typeof bonus === "object" ? { pct: num(bonus.pct), below: num(bonus.below, 0.5) } : null,
    dot: tick(e.dot), hot,
    supported: !needsArena && !empty && !noHeal,
  };
}

/** A fighter's basic attack and the special skills they can use on the floor, in slot order. */
export function kitOf(skills: SkillRef[]): { basic: FloorSkill | null; specials: FloorSkill[] } {
  const all = skills
    .map((s) => ({ s, f: floorSkillOf(s) }))
    .filter((x): x is { s: SkillRef; f: FloorSkill } => x.f !== null);
  const basic = all.find((x) => x.s.basic)?.f ?? null;
  return { basic, specials: all.filter((x) => !x.s.basic && x.f.supported).map((x) => x.f) };
}

/** Projectile art for a skill: the same picks the arena makes. */
export const shotFor = (s: FloorSkill, role: Role): Fx => shotArt(s.name, role, s.kind, s.magical ? "magical" : "physical");
export const modFx = (m: Mod): Fx => modArt(m.stat, m.pct);
export const HEAL_FX: Fx = { sheet: "support", row: 0 };

// ---- drawing. Effects are short-lived DOM nodes on the map, so they cost no React renders. ----

const Z = 8000; // above every unit and prop, below the floating numbers

function sheetNode(fx: Fx, sizePx: number, ms: number, loop: boolean) {
  const d = document.createElement("div");
  d.setAttribute("aria-hidden", "true");
  Object.assign(d.style, {
    position: "absolute", left: "0", top: "0", width: `${sizePx}px`, height: `${sizePx}px`,
    marginLeft: `${-sizePx / 2}px`, marginTop: `${-sizePx / 2}px`, pointerEvents: "none", zIndex: String(Z),
    backgroundImage: `url(/sprites/fx_${fx.sheet}.png)`, backgroundSize: `${FX_COLS * 100}% ${FX_ROWS * 100}%`,
    backgroundPosition: `0% ${(fx.row / (FX_ROWS - 1)) * 100}%`, backgroundRepeat: "no-repeat",
    animation: `spr ${ms}ms steps(${FX_COLS}, jump-none) ${loop ? "infinite" : "1 forwards"}`,
  });
  d.style.setProperty("--to", "100%");
  return d;
}

/** An effect that plays in place (heal sparkles, buff and debuff marks). Positions are in tiles. */
export function playVfx(world: HTMLElement | null, T: number, x: number, y: number, fx: Fx, widthTiles: number, ms = 560) {
  if (!world) return;
  const d = sheetNode(fx, widthTiles * T, ms, false);
  d.style.transform = `translate(${x * T}px, ${y * T}px)`;
  world.appendChild(d);
  setTimeout(() => d.remove(), ms + 80);
}

/** A projectile flying from one point to another. */
export function playShot(world: HTMLElement | null, T: number, x1: number, y1: number, x2: number, y2: number, fx: Fx, ms = SHOT_MS) {
  if (!world) return;
  const d = sheetNode(fx, 1.7 * T, 420, true);
  const flip = x2 < x1 ? -1 : 1;
  const at = (x: number, y: number) => `translate(${x * T}px, ${y * T}px) scaleX(${flip})`;
  d.style.transform = at(x1, y1);
  world.appendChild(d);
  const run = d.animate([{ transform: at(x1, y1) }, { transform: at(x2, y2) }], { duration: ms, easing: "linear", fill: "forwards" });
  run.onfinish = () => d.remove();
  setTimeout(() => d.remove(), ms + 100);
}

/** The ring an area attack leaves behind (the arena's "burst"). */
export function playBurst(world: HTMLElement | null, T: number, x: number, y: number, radius: number, ms = 500) {
  if (!world) return;
  const d = document.createElement("div");
  d.className = "burst";
  d.setAttribute("aria-hidden", "true");
  Object.assign(d.style, {
    position: "absolute", left: `${x * T}px`, top: `${y * T}px`, width: `${radius * 2 * T}px`, height: `${radius * 1.4 * T}px`,
    borderRadius: "50%", border: "4px solid var(--gold)", background: "color-mix(in srgb, var(--paper) 70%, transparent)",
    pointerEvents: "none", zIndex: String(Z),
  });
  world.appendChild(d);
  setTimeout(() => d.remove(), ms + 50);
}
