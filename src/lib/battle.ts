"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { getGameSocket } from "@/lib/socket";

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
  skills: { index: number; name: string; kind: SkillKind; cooldownMs: number; staminaCost: number; range: number }[];
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
  cooldowns: number[];
}

export interface BattleSnapshot {
  timeMs: number;
  arena: { w: number; h: number };
  stances: Record<Side, Stance>;
  units: SnapshotUnit[];
}

export type BattleEvent =
  | { t: number; type: "move"; units: { id: string; x: number; y: number }[] }
  | { t: number; type: "stance"; side: Side; stance: Stance }
  | { t: number; type: "cast"; actorId: string; skill: string; skillIndex: number; targetIds: string[] }
  | { t: number; type: "damage"; sourceId: string; targetId: string; amount: number; absorbed: number; hp: number }
  | { t: number; type: "heal"; sourceId: string; targetId: string; amount: number; hp: number }
  | { t: number; type: "shield"; sourceId: string; targetId: string; amount: number }
  | { t: number; type: "mod"; sourceId: string; targetId: string; stat: string; pct: number; durationMs: number }
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

export type FxKind = "lunge" | "hurt" | "heal" | "shield" | "dead" | null;

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
  /** `n` changes on every effect so the CSS animation restarts. */
  fx: { kind: FxKind; n: number };
}

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: "dmg" | "heal" | "shield" | "ko" | "block" | "mod";
}

export interface BattleView {
  matchId: string;
  difficulty: Difficulty;
  metas: UnitMeta[];
  controlledUnitId: string | null;
  arena: { w: number; h: number };
  units: Record<string, LiveUnit>;
  stances: Record<Side, Stance>;
  /** Battle clock in ms, advanced by every event and sync from the server. */
  timeMs: number;
  texts: FloatText[];
  log: string;
  focusId: string | null;
  nextId: number;
  end: BattleEndPayload | null;
}

type Action =
  | { type: "start"; payload: BattleStartPayload }
  | { type: "events"; matchId: string; events: BattleEvent[] }
  | { type: "sync"; matchId: string; snapshot: BattleSnapshot }
  | { type: "end"; payload: BattleEndPayload }
  | { type: "focus"; id: string }
  | { type: "clearText"; id: number }
  | { type: "reset" };

const SPEED_SCALE = 50; // same curve the server uses: cooldown = base * 50 / (50 + spd)
const estimateCooldown = (baseMs: number, spd: number) => Math.round((baseMs * SPEED_SCALE) / (SPEED_SCALE + Math.max(0, spd)));

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
      fx: prev?.fx ?? { kind: s.alive ? null : "dead", n: 0 },
    };
  }
  return next;
}

function applyEvents(view: BattleView, events: BattleEvent[]): BattleView {
  const units = { ...view.units };
  const texts = [...view.texts];
  let { timeMs, log, nextId } = view;
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
    if (u) texts.push({ id: nextId++, x: u.x, y: u.y, text, kind });
  };

  for (const e of events) {
    timeMs = Math.max(timeMs, e.t);
    switch (e.type) {
      case "move":
        for (const m of e.units) touch(m.id, { x: m.x, y: m.y });
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
        // Only close-range attacks lunge; ranged and support skills show their effect on the target.
        touch(e.actorId, { cooldownEnds, energy: Math.max(0, u.energy - skill.staminaCost) }, skill.kind === "damage" && skill.range <= 3 ? "lunge" : undefined);
        log = e.skillIndex === 0 ? `${actor.name} attacks` : `${actor.name} uses ${skill.name}`;
        break;
      }
      case "damage": {
        touch(e.targetId, { hp: e.hp }, "hurt");
        const dealt = e.amount - e.absorbed;
        if (dealt <= 0) say(e.targetId, "BLOCKED", "block");
        else say(e.targetId, `-${dealt}`, "dmg");
        break;
      }
      case "heal":
        touch(e.targetId, { hp: e.hp }, "heal");
        if (e.amount > 0) say(e.targetId, `+${e.amount}`, "heal");
        break;
      case "shield":
        touch(e.targetId, { shield: e.amount }, "shield");
        say(e.targetId, "SHIELD", "shield");
        break;
      case "mod":
        say(e.targetId, `${e.pct > 0 ? "+" : ""}${e.pct}% ${e.stat.toUpperCase()}`, "mod");
        break;
      case "death":
        touch(e.unitId, { hp: 0, alive: false }, "dead");
        say(e.unitId, "KO!", "ko");
        log = `${meta(e.unitId)?.name ?? "A fighter"} is down`;
        break;
      case "end":
        break;
    }
  }
  return { ...view, units, texts, stances, timeMs, log, nextId };
}

function reducer(view: BattleView | null, action: Action): BattleView | null {
  switch (action.type) {
    case "start": {
      const p = action.payload;
      return {
        matchId: p.matchId,
        difficulty: p.difficulty,
        metas: p.units,
        controlledUnitId: p.controlledUnitId,
        arena: p.snapshot.arena,
        units: applySnapshot({}, p.snapshot),
        stances: p.snapshot.stances,
        timeMs: p.snapshot.timeMs,
        texts: [],
        log: "Fight!",
        focusId: null,
        nextId: 1,
        end: null,
      };
    }
    case "events":
      return view && view.matchId === action.matchId ? applyEvents(view, action.events) : view;
    case "sync":
      return view && view.matchId === action.matchId
        ? { ...view, units: applySnapshot(view.units, action.snapshot), stances: action.snapshot.stances, timeMs: Math.max(view.timeMs, action.snapshot.timeMs) }
        : view;
    case "end":
      return view && view.matchId === action.payload.matchId ? { ...view, end: action.payload } : view;
    case "focus":
      return view ? { ...view, focusId: action.id } : view;
    case "clearText":
      return view ? { ...view, texts: view.texts.filter((t) => t.id !== action.id) } : view;
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

const TEXT_LIFETIME_MS = 1100;

/** Runs one practice match against the game server and exposes what the arena needs to draw it. */
export function useSoloBattle() {
  const [view, dispatch] = useReducer(reducer, null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [error, setError] = useState<string | null>(null);
  /** The most recent payout from the server. Outlives a single match so the lobby shows fresh numbers. */
  const [lastReward, setLastReward] = useState<RewardSummary | null>(null);

  useEffect(() => {
    const socket = getGameSocket();

    const onStart = (payload: BattleStartPayload) => {
      dispatch({ type: "start", payload });
      setError(null);
      setPhase("fighting");
    };
    const onEvents = (p: { matchId: string; events: BattleEvent[] }) => dispatch({ type: "events", ...p });
    const onSync = (p: { matchId: string; snapshot: BattleSnapshot }) => dispatch({ type: "sync", ...p });
    const onEnd = (payload: BattleEndPayload) => {
      dispatch({ type: "end", payload });
      if (payload.reward) setLastReward(payload.reward);
      setPhase("ended");
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
      socket.off("battle:start", onStart);
      socket.off("battle:events", onEvents);
      socket.off("battle:sync", onSync);
      socket.off("battle:end", onEnd);
      socket.off("connect", rejoin);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  // Floating numbers clean themselves up once their animation is over.
  const texts = view?.texts;
  useEffect(() => {
    if (!texts?.length) return;
    const timers = texts.map((t) => setTimeout(() => dispatch({ type: "clearText", id: t.id }), TEXT_LIFETIME_MS));
    return () => timers.forEach(clearTimeout);
  }, [texts]);

  const start = useCallback((difficulty: Difficulty, controlledFighterId: string | null) => {
    const socket = getGameSocket();
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
  const setStance = useCallback((stance: Stance) => getGameSocket().emit("battle:stance", stance), []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    setError(null);
    setPhase("lobby");
  }, []);

  return { phase, view, error, lastReward, start, cast, focus, setStance, reset };
}
