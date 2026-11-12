"use client";

import type { FxSheet } from "@/lib/sprites/designs";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getGameSocket } from "@/lib/socket";
import { playSfx, unlockAudio, type Sfx } from "@/lib/sfx";

/*
 * The browser's side of the battle protocol. These shapes mirror `modules/battle/protocol.ts` in
 * hustle-royale-server. The server runs the fight; this file only turns what it streams into
 * something the arena can draw.
 */

export type Side = 1 | 2;
export type Role = "tank" | "healer" | "dps";
export type Stance = "offensive" | "neutral" | "defensive";
export type Difficulty = "rookie" | "hustler" | "boss";
export type SkillKind = "damage" | "heal" | "shield" | "buff" | "debuff";

export interface UnitMeta {
  id: string;
  side: Side;
  name: string;
  role: Role;
  spriteKey: string;
  grade: string | null;
  level: number;
  spd: number;
  controlled: boolean;
  /** A minion that sits out until its owner summons it. */
  summon?: boolean;
  skills: {
    index: number;
    name: string;
    kind: SkillKind;
    damageType: "physical" | "magical" | "none";
    cooldownMs: number;
    staminaCost: number;
    range: number;
    /** Big attacks show a danger zone first. */
    telegraphMs?: number;
    radius?: number;
    stunMs?: number;
    knockback?: number;
    pull?: number;
  }[];
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  r: number;
  kind: "pillar" | "stall";
}

export interface MatchClock {
  regularMs: number;
  shrinkMs: number;
  minRadius: number;
  capMs: number;
}

interface SnapshotUnit {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  alive: boolean;
  stunMs: number;
  manual: boolean;
  windup: { id: number; x: number; y: number; radius: number; remainingMs: number; totalMs: number } | null;
  cooldowns: number[];
}

export interface BattleSnapshot {
  timeMs: number;
  arena: { w: number; h: number };
  stances: Record<Side, Stance>;
  finished: boolean;
  winnerSide: Side | null;
  layout: string;
  obstacles: Obstacle[];
  clock: MatchClock;
  units: SnapshotUnit[];
}

export type BattleEvent =
  | { t: number; type: "move"; units: { id: string; x: number; y: number }[] }
  | { t: number; type: "stance"; side: Side; stance: Stance }
  | { t: number; type: "cast"; actorId: string; skill: string; skillIndex: number; targetIds: string[] }
  | { t: number; type: "damage"; sourceId: string; targetId: string; amount: number; absorbed: number; hp: number; mult?: number; ring?: boolean; dot?: boolean; crit?: boolean }
  | { t: number; type: "heal"; sourceId: string; targetId: string; amount: number; hp: number; quiet?: boolean }
  | { t: number; type: "shield"; sourceId: string; targetId: string; amount: number }
  | { t: number; type: "mod"; sourceId: string; targetId: string; stat: string; pct: number; durationMs: number }
  | { t: number; type: "telegraph"; id: number; actorId: string; skill: string; skillIndex: number; x: number; y: number; radius: number; durationMs: number }
  | { t: number; type: "burst"; id: number; actorId: string; x: number; y: number; radius: number }
  | { t: number; type: "stun"; sourceId: string; targetId: string; durationMs: number }
  | { t: number; type: "interrupt"; unitId: string; id: number }
  | { t: number; type: "displace"; unitId: string; x: number; y: number; fromX: number; fromY: number }
  | { t: number; type: "phase"; phase: "warning" | "sudden_death" }
  | { t: number; type: "evade"; sourceId: string; targetId: string }
  | { t: number; type: "cleanse"; targetId: string }
  | { t: number; type: "summon"; ownerId: string; unitId: string; x: number; y: number }
  | { t: number; type: "death"; unitId: string }
  | { t: number; type: "end"; winnerSide: Side | null };

export interface RewardSummary {
  coinsEarned: number;
  base: number;
  multiplier: number;
  dailyCap: number;
  earnedToday: number;
  paidMatchesToday: number;
  capped: boolean;
  balance: number;
}

export interface BattleStartPayload {
  matchId: string;
  difficulty: Difficulty;
  yourSide: Side;
  controlledUnitId: string | null;
  tickMs: number;
  units: UnitMeta[];
  snapshot: BattleSnapshot;
}

export interface BattleEndPayload {
  matchId: string;
  result: "win" | "loss" | "draw";
  winnerSide: Side | null;
  durationMs: number;
  damageDealt: number;
  reward: RewardSummary | null;
}

type StartError = "invalid_request" | "match_in_progress" | "no_team" | "invalid_team" | "server_error";
type StartAck = { ok: true; matchId: string } | { ok: false; error: StartError };

/* ---------------------------------------------------------------- live view state */

export type FxKind = "lunge" | "hurt" | "heal" | "shield" | "dead" | "cast" | null;

export interface LiveUnit {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  alive: boolean;
  /** Battle-clock time (ms) at which each skill is ready again. */
  cooldownEnds: number[];
  /** Battle-clock times: stunned until, charging a big attack until, walking until. */
  stunUntil: number;
  windupUntil: number;
  walkUntil: number;
  /** `n` changes on every effect so the CSS animation restarts. */
  fx: { kind: FxKind; n: number };
}

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: "dmg" | "heal" | "shield" | "ko" | "block" | "mod" | "crit" | "weak" | "stun";
  /** Wall-clock time this text can be dropped. */
  expires: number;
}

/** Short-lived visuals: danger zones, explosions and shots. */
export interface Effect {
  id: number;
  kind: "zone" | "burst" | "shot" | "vfx";
  /** Skill-effect animation (sheet + row) for "vfx" impacts and for shot projectiles. */
  fx?: { sheet: FxSheet; row: number };
  x: number;
  y: number;
  radius: number;
  /** Shots travel from (x, y) to (x2, y2). */
  x2: number;
  y2: number;
  durationMs: number;
  /** Id of the server-side wind-up, so a burst or interrupt removes its own zone. */
  zoneId: number;
  tone: "physical" | "magical" | "heal";
  side: Side;
  expires: number;
}

export type MatchPhase = "normal" | "warning" | "sudden";

export interface BattleView {
  matchId: string;
  difficulty: Difficulty;
  metas: UnitMeta[];
  controlledUnitId: string | null;
  arena: { w: number; h: number };
  obstacles: Obstacle[];
  layout: string;
  clock: MatchClock;
  phase: MatchPhase;
  /** Battle time (ms) when sudden death began, or null. */
  suddenAt: number | null;
  units: Record<string, LiveUnit>;
  stances: Record<Side, Stance>;
  /** Battle clock in ms, advanced by every event and sync from the server. */
  timeMs: number;
  texts: FloatText[];
  effects: Effect[];
  /** Counters that restart screen effects: `power` is 1 (small) to 3 (big). */
  shake: { n: number; power: number };
  hitStop: number;
  /** The fighter whose fall decided the match, for the slow-motion finish. */
  finalBlowId: string | null;
  log: string;
  focusId: string | null;
  nextId: number;
  end: BattleEndPayload | null;
}

export type BattleAction =
  | { type: "start"; payload: BattleStartPayload; now: number }
  | { type: "events"; matchId: string; events: BattleEvent[]; now: number }
  | { type: "sync"; matchId: string; snapshot: BattleSnapshot }
  | { type: "end"; payload: BattleEndPayload }
  | { type: "focus"; id: string }
  | { type: "prune"; now: number }
  | { type: "reset" };

const SPEED_SCALE = 50; // same curve the server uses: cooldown = base * 50 / (50 + spd)
const estimateCooldown = (baseMs: number, spd: number) => Math.round((baseMs * SPEED_SCALE) / (SPEED_SCALE + Math.max(0, spd)));

const TEXT_LIFETIME_MS = 1100;
const WALK_GRACE_MS = 260;
/** Ranged skills show a flying shot; anything shorter than this is a melee swing. */
const MELEE_RANGE = 3;

function applySnapshot(units: Record<string, LiveUnit>, snap: BattleSnapshot): Record<string, LiveUnit> {
  const next = { ...units };
  for (const s of snap.units) {
    const prev = units[s.id];
    next[s.id] = {
      id: s.id,
      x: s.x,
      y: s.y,
      hp: s.hp,
      maxHp: s.maxHp,
      energy: s.energy,
      maxEnergy: s.maxEnergy,
      shield: s.shield,
      alive: s.alive,
      cooldownEnds: s.cooldowns.map((c) => snap.timeMs + c),
      stunUntil: snap.timeMs + s.stunMs,
      windupUntil: s.windup ? snap.timeMs + s.windup.remainingMs : 0,
      walkUntil: prev?.walkUntil ?? 0,
      fx: prev?.fx ?? { kind: s.alive ? null : "dead", n: 0 },
    };
  }
  return next;
}

/** Which projectile a skill throws. Named skills have their own art; the rest go by role and damage type. */
function shotArt(name: string, role: string, kind: string, damageType: string): NonNullable<Effect["fx"]> {
  switch (name) {
    case "Sonic Note": return { sheet: "shot2", row: 0 };
    case "Aimed Shot": case "Pin Shot": case "Poison Arrow": return { sheet: "shot2", row: 1 };
    case "Dark Bolt": case "Soul Drain": return { sheet: "shot2", row: 2 };
    case "Shadow Step": return { sheet: "shot2", row: 3 };
  }
  return { sheet: "shot", row: role === "healer" || kind === "heal" ? 3 : damageType === "magical" ? (role === "dps" ? 2 : 1) : 0 };
}

/** Buff and debuff art by what changed. */
function modArt(stat: string, pct: number): NonNullable<Effect["fx"]> {
  if (stat === "spd") return { sheet: "support2", row: pct > 0 ? 1 : 2 };
  if (stat === "atk" && pct > 0) return { sheet: "support2", row: 0 };
  if (stat === "def" && pct < 0) return { sheet: "support2", row: 3 };
  return { sheet: "support", row: pct < 0 ? 3 : 2 };
}

function applyEvents(view: BattleView, events: BattleEvent[], now: number): BattleView {
  const units = { ...view.units };
  let texts = [...view.texts];
  let effects = [...view.effects];
  let { timeMs, log, nextId, phase, suddenAt, shake, hitStop, finalBlowId } = view;
  const stances = { ...view.stances };
  const meta = (id: string) => view.metas.find((m) => m.id === id);

  const touch = (id: string, patch: Partial<LiveUnit>, fx?: FxKind) => {
    const u = units[id];
    if (!u) return undefined;
    const bump = fx !== undefined && !(u.fx.kind === "dead" && fx !== "dead");
    units[id] = { ...u, ...patch, fx: bump ? { kind: fx, n: u.fx.n + 1 } : u.fx };
    return units[id];
  };
  const say = (id: string, text: string, kind: FloatText["kind"]) => {
    const u = units[id];
    if (u) texts.push({ id: nextId++, x: u.x, y: u.y, text, kind, expires: now + TEXT_LIFETIME_MS });
  };
  const addEffect = (e: Omit<Effect, "id" | "expires" | "x2" | "y2" | "zoneId" | "radius" | "durationMs"> & Partial<Effect>) => {
    effects.push({ id: nextId++, radius: 0, x2: e.x, y2: e.y, durationMs: 400, zoneId: -1, ...e, expires: now + (e.durationMs ?? 400) + 300 });
  };
  const vfx = (id: string, fx: NonNullable<Effect["fx"]>, durationMs = 560) => {
    const u = units[id];
    if (u) addEffect({ kind: "vfx", x: u.x, y: u.y, tone: "physical", side: meta(id)?.side ?? 1, fx, durationMs });
  };
  const bigShake = (power: number) => {
    shake = { n: shake.n + 1, power: Math.max(power, shake.power > 0 && shake.n === view.shake.n ? shake.power : 0) };
  };

  for (const e of events) {
    timeMs = Math.max(timeMs, e.t);
    switch (e.type) {
      case "move":
        for (const m of e.units) touch(m.id, { x: m.x, y: m.y, walkUntil: e.t + WALK_GRACE_MS });
        break;
      case "stance":
        stances[e.side] = e.stance;
        break;
      case "cast": {
        const actor = meta(e.actorId);
        const skill = actor?.skills[e.skillIndex];
        const u = units[e.actorId];
        if (!actor || !skill || !u) break;
        const cooldownEnds = [...u.cooldownEnds];
        cooldownEnds[e.skillIndex] = e.t + estimateCooldown(skill.cooldownMs, actor.spd);
        const melee = skill.range <= MELEE_RANGE;
        touch(
          e.actorId,
          { cooldownEnds, energy: Math.max(0, u.energy - skill.staminaCost), windupUntil: 0 },
          skill.kind === "damage" && melee ? "lunge" : skill.kind === "damage" || skill.kind === "heal" ? "cast" : undefined,
        );
        // Ranged hits and heals fly across the arena. Telegraphed attacks get their own zone effect instead.
        const target = units[e.targetIds[0] ?? ""];
        if (!melee && !skill.telegraphMs && target && (skill.kind === "damage" || skill.kind === "heal")) {
          addEffect({
            kind: "shot",
            x: u.x,
            y: u.y,
            x2: target.x,
            y2: target.y,
            durationMs: 260,
            tone: skill.kind === "heal" ? "heal" : skill.damageType === "magical" ? "magical" : "physical",
            side: actor.side,
            fx: shotArt(skill.name, actor.role, skill.kind, skill.damageType),
          });
        }
        if (skill.name === "Vanish") vfx(e.actorId, { sheet: "ground", row: 1 }, 600);
        log = e.skillIndex === 0 ? `${actor.name} attacks` : `${actor.name} uses ${skill.name}`;
        break;
      }
      case "telegraph": {
        const actor = meta(e.actorId);
        const skill = actor?.skills[e.skillIndex];
        touch(e.actorId, { windupUntil: e.t + e.durationMs }, "cast");
        addEffect({
          kind: "zone",
          x: e.x,
          y: e.y,
          radius: e.radius,
          durationMs: e.durationMs,
          zoneId: e.id,
          tone: skill?.damageType === "magical" ? "magical" : "physical",
          side: actor?.side ?? 2,
        });
        if (actor) log = `${actor.name} is charging ${skill?.name ?? "a big attack"}! Step out of the circle`;
        break;
      }
      case "burst":
        effects = effects.filter((f) => !(f.kind === "zone" && f.zoneId === e.id));
        addEffect({ kind: "burst", x: e.x, y: e.y, radius: e.radius, durationMs: 500, zoneId: e.id, tone: "physical", side: meta(e.actorId)?.side ?? 2 });
        touch(e.actorId, { windupUntil: 0 });
        bigShake(2);
        break;
      case "interrupt":
        effects = effects.filter((f) => !(f.kind === "zone" && f.zoneId === e.id));
        touch(e.unitId, { windupUntil: 0 });
        say(e.unitId, "INTERRUPTED!", "stun");
        break;
      case "stun":
        touch(e.targetId, { stunUntil: e.t + e.durationMs });
        say(e.targetId, "STUNNED", "stun");
        break;
      case "displace":
        // The browser glides the sprite from where it was to where it landed, so a shove reads as a shove.
        touch(e.unitId, { x: e.x, y: e.y });
        break;
      case "phase":
        if (e.phase === "warning") {
          phase = "warning";
          log = "Sudden death is coming! The ring closes soon";
        } else {
          phase = "sudden";
          suddenAt = e.t;
          log = "SUDDEN DEATH! Stay inside the ring";
          bigShake(2);
        }
        break;
      case "damage": {
        const target = units[e.targetId];
        touch(e.targetId, { hp: e.hp }, e.dot ? undefined : "hurt");
        const dealt = e.amount - e.absorbed;
        if (e.ring || e.dot) say(e.targetId, `-${dealt}`, "dmg");
        else if (e.crit) say(e.targetId, `-${dealt}!`, "crit");
        else if (dealt <= 0) say(e.targetId, "BLOCKED", "block");
        else if (e.mult && e.mult > 1.05) say(e.targetId, `-${dealt}!`, "crit");
        else if (e.mult && e.mult < 0.95) say(e.targetId, `-${dealt}`, "weak");
        else say(e.targetId, `-${dealt}`, "dmg");
        const heavy = target && dealt >= target.maxHp * 0.12;
        if (heavy) bigShake(1);
        break;
      }
      case "heal":
        touch(e.targetId, { hp: e.hp }, e.quiet ? undefined : "heal");
        if (e.amount > 0) say(e.targetId, `+${e.amount}`, "heal");
        if (!e.quiet) vfx(e.targetId, { sheet: "support", row: 0 });
        break;
      case "shield":
        touch(e.targetId, { shield: e.amount }, "shield");
        say(e.targetId, "SHIELD", "shield");
        vfx(e.targetId, { sheet: "support", row: 1 }, 700);
        break;
      case "mod":
        say(e.targetId, `${e.pct > 0 ? "+" : ""}${e.pct}% ${e.stat.toUpperCase()}`, "mod");
        vfx(e.targetId, modArt(e.stat, e.pct));
        break;
      case "evade":
        say(e.targetId, "DODGE", "block");
        break;
      case "cleanse":
        say(e.targetId, "CLEANSED", "shield");
        vfx(e.targetId, { sheet: "support", row: 0 });
        break;
      case "summon": {
        const u = units[e.unitId];
        if (u) units[e.unitId] = { ...u, x: e.x, y: e.y, alive: true, hp: Math.max(1, u.hp || 1), fx: { kind: null, n: u.fx.n + 1 } };
        vfx(e.unitId, { sheet: "ground", row: 1 }, 600);
        log = `${meta(e.ownerId)?.name ?? "A fighter"} raises a skeleton`;
        break;
      }
      case "death":
        touch(e.unitId, { hp: 0, alive: false, windupUntil: 0 }, "dead");
        say(e.unitId, "KO!", "ko");
        log = `${meta(e.unitId)?.name ?? "A fighter"} is down`;
        finalBlowId = e.unitId;
        hitStop += 1;
        bigShake(3);
        break;
      case "end":
        break;
    }
  }
  texts = texts.slice(-24);
  effects = effects.slice(-24);
  return { ...view, units, texts, effects, stances, timeMs, log, nextId, phase, suddenAt, shake, hitStop, finalBlowId };
}

export function battleReducer(view: BattleView | null, action: BattleAction): BattleView | null {
  switch (action.type) {
    case "start": {
      const p = action.payload;
      const t = p.snapshot.timeMs;
      return {
        matchId: p.matchId,
        difficulty: p.difficulty,
        metas: p.units,
        controlledUnitId: p.controlledUnitId,
        arena: p.snapshot.arena,
        obstacles: p.snapshot.obstacles ?? [],
        layout: p.snapshot.layout ?? "",
        clock: p.snapshot.clock,
        phase: t >= p.snapshot.clock.regularMs ? "sudden" : t >= p.snapshot.clock.regularMs - 10_000 ? "warning" : "normal",
        suddenAt: t >= p.snapshot.clock.regularMs ? p.snapshot.clock.regularMs : null,
        units: applySnapshot({}, p.snapshot),
        stances: p.snapshot.stances,
        timeMs: t,
        texts: [],
        effects: [],
        shake: { n: 0, power: 0 },
        hitStop: 0,
        finalBlowId: null,
        log: "Fight!",
        focusId: null,
        nextId: 1,
        end: null,
      };
    }
    case "events":
      return view && view.matchId === action.matchId ? applyEvents(view, action.events, action.now) : view;
    case "sync": {
      if (!view || view.matchId !== action.matchId) return view;
      const zonesNow = new Set(action.snapshot.units.flatMap((u) => (u.windup ? [u.windup.id] : [])));
      return {
        ...view,
        units: applySnapshot(view.units, action.snapshot),
        stances: action.snapshot.stances,
        timeMs: Math.max(view.timeMs, action.snapshot.timeMs),
        // A zone the server no longer reports (cancelled while we missed the event) must not linger.
        effects: view.effects.filter((f) => f.kind !== "zone" || zonesNow.has(f.zoneId)),
      };
    }
    case "end":
      return view && view.matchId === action.payload.matchId ? { ...view, end: action.payload } : view;
    case "focus":
      return view ? { ...view, focusId: action.id } : view;
    case "prune": {
      if (!view) return view;
      const texts = view.texts.filter((t) => t.expires > action.now);
      const effects = view.effects.filter((f) => f.expires > action.now);
      return texts.length === view.texts.length && effects.length === view.effects.length ? view : { ...view, texts, effects };
    }
    case "reset":
      return null;
  }
}

/* ---------------------------------------------------------------- the hook */

export type Phase = "lobby" | "starting" | "fighting" | "ended";

const START_ERRORS: Record<StartError, string> = {
  invalid_request: "That match setup didn't work. Pick again and try once more.",
  match_in_progress: "Your last match is still wrapping up. Try again in a moment.",
  no_team: "You have no fighters on your team yet.",
  invalid_team: "Your team can't fight right now. Check your fighters.",
  server_error: "The arena had a problem. Try again in a moment.",
};

/** How long the slow-motion finish plays before the result panel appears. */
export const FINALE_MS = 1800;

/** Runs one practice match against the game server and exposes what the arena needs to draw it. */
export function useSoloBattle() {
  const [view, dispatch] = useReducer(battleReducer, null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [error, setError] = useState<string | null>(null);
  /** The most recent payout from the server. Outlives a single match so the lobby shows fresh numbers. */
  const [lastReward, setLastReward] = useState<RewardSummary | null>(null);
  const finaleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef(0);

  useEffect(() => {
    const socket = getGameSocket();

    const onStart = (payload: BattleStartPayload) => {
      if (finaleTimer.current) clearTimeout(finaleTimer.current);
      dispatch({ type: "start", payload, now: Date.now() });
      setError(null);
      setPhase("fighting");
    };
    const onEvents = (p: { matchId: string; events: BattleEvent[] }) => {
      dispatch({ type: "events", ...p, now: Date.now() });
      // Sounds are a side effect of the stream, played once per event, outside the reducer.
      for (const e of p.events) {
        const name = soundFor(e);
        if (name) playSfx(name);
      }
    };
    const onSync = (p: { matchId: string; snapshot: BattleSnapshot }) => dispatch({ type: "sync", ...p });
    const onEnd = (payload: BattleEndPayload) => {
      dispatch({ type: "end", payload });
      if (payload.reward) setLastReward(payload.reward);
      // Let the last blow play out in slow motion before the result takes over the screen.
      finaleTimer.current = setTimeout(() => {
        setPhase("ended");
        playSfx(payload.result === "win" ? "win" : payload.result === "loss" ? "lose" : "ko");
      }, FINALE_MS);
    };
    // Back on this screen mid-match (refresh, or came back from another page): ask for it again.
    const rejoin = () => socket.emit("battle:rejoin");
    const onConnectError = (err: Error) => {
      setError(err.message === "unauthorized" ? "You are signed out. Log in again." : "Can't reach the game server. Check your connection.");
      setPhase((p) => (p === "starting" ? "lobby" : p));
    };

    socket.on("battle:start", onStart);
    socket.on("battle:events", onEvents);
    socket.on("battle:sync", onSync);
    socket.on("battle:end", onEnd);
    socket.on("connect", rejoin);
    socket.on("connect_error", onConnectError);
    if (socket.connected) rejoin();
    else socket.connect();

    return () => {
      if (finaleTimer.current) clearTimeout(finaleTimer.current);
      socket.off("battle:start", onStart);
      socket.off("battle:events", onEvents);
      socket.off("battle:sync", onSync);
      socket.off("battle:end", onEnd);
      socket.off("connect", rejoin);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  // Floating numbers and one-off effects clear themselves after their animation is over.
  const hasTransient = !!view && (view.texts.length > 0 || view.effects.length > 0);
  useEffect(() => {
    if (!hasTransient) return;
    const timer = setInterval(() => dispatch({ type: "prune", now: Date.now() }), 150);
    return () => clearInterval(timer);
  }, [hasTransient]);

  const start = useCallback((difficulty: Difficulty, controlledFighterId: string | null) => {
    const socket = getGameSocket();
    unlockAudio(); // browsers only allow sound after a tap, and this is that tap
    setError(null);
    setPhase("starting");

    const go = () =>
      socket.timeout(8000).emit("solo:start", { difficulty, controlledFighterId }, (err: Error | null, ack?: StartAck) => {
        if (err || !ack) {
          setError("The game server didn't answer. Try again.");
          setPhase("lobby");
        } else if (!ack.ok) {
          setError(START_ERRORS[ack.error]);
          setPhase("lobby");
          // If a match really is running for us, this brings it straight back.
          if (ack.error === "match_in_progress") socket.emit("battle:rejoin");
        }
        // On success the server's `battle:start` moves us into the fight.
      });

    if (socket.connected) go();
    else {
      socket.once("connect", go);
      socket.connect();
    }
  }, []);

  const cast = useCallback((skillIndex: number) => getGameSocket().emit("battle:intent", { type: "cast", skillIndex }), []);
  const focus = useCallback((id: string) => {
    getGameSocket().emit("battle:intent", { type: "focus", targetId: id });
    dispatch({ type: "focus", id });
  }, []);
  /** Walk the fighter you control to a spot (arena units). Streamed from held keys, so it is throttled. */
  const move = useCallback((x: number, y: number) => {
    const now = performance.now();
    if (now - lastMove.current < 70) return;
    lastMove.current = now;
    getGameSocket().emit("battle:intent", { type: "move", x, y });
  }, []);
  /** Hand the fighter back to its own AI. */
  const auto = useCallback(() => getGameSocket().emit("battle:intent", { type: "auto" }), []);
  const setStance = useCallback((stance: Stance) => getGameSocket().emit("battle:stance", stance), []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    setError(null);
    setPhase("lobby");
  }, []);

  return { phase, view, error, lastReward, start, cast, focus, move, auto, setStance, reset };
}

function soundFor(e: BattleEvent): Sfx | null {
  switch (e.type) {
    case "cast":
      return e.skillIndex === 0 ? "swing" : null;
    case "damage":
      return (e.mult ?? 1) > 1.05 ? "crit" : "hit";
    case "heal":
      return "heal";
    case "shield":
      return "shield";
    case "stun":
      return "stun";
    case "telegraph":
      return "warn";
    case "burst":
      return "boom";
    case "phase":
      return "horn";
    case "death":
      return "ko";
    default:
      return null;
  }
}
