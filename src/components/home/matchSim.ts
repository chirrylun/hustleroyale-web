/**
 * A tiny, purely visual battle for the homepage. It is NOT the real game engine (that lives on
 * the server and decides every real match); it only shows new players how a match feels.
 */
export type Side = "A" | "B";
export type SimRole = "tank" | "healer" | "dps";
export type FxKind = "lunge" | "hurt" | "heal" | "shield" | "dead" | null;

export interface SimUnit {
  id: string;
  side: Side;
  role: SimRole;
  name: string;
  sprite: string;
  move: string;
  x: number; // % across the arena
  y: number; // % down the arena (where the feet stand)
  hp: number;
  maxHp: number;
  shield: number;
  alive: boolean;
  fx: { kind: FxKind; id: number };
}

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: "dmg" | "crit" | "heal" | "shield" | "ko";
}

export interface Sim {
  units: SimUnit[];
  turn: number;
  cursor: number;
  log: string;
  texts: FloatText[];
  winner: Side | null;
  holdTicks: number;
}

export type Rnd = () => number;

const mk = (
  id: string,
  side: Side,
  role: SimRole,
  name: string,
  sprite: string,
  move: string,
  x: number,
  y: number,
  maxHp: number,
): SimUnit => ({
  id,
  side,
  role,
  name,
  sprite,
  move,
  x: side === "A" ? x : 100 - x,
  y,
  hp: maxHp,
  maxHp,
  shield: 0,
  alive: true,
  fx: { kind: null, id: 0 },
});

/** Acting order: it alternates between the two teams so the fight feels back and forth. */
const ORDER = ["A-dps", "B-tank", "A-healer", "B-dps", "A-tank", "B-healer"];

export function createMatch(cursor = 0): Sim {
  return {
    units: [
      mk("A-tank", "A", "tank", "Danfo Guard", "danfo_guard", "Guard Up", 38, 84, 110),
      mk("A-dps", "A", "dps", "Street Scrapper", "street_scrapper", "Pipe Smash", 23, 68, 75),
      mk("A-healer", "A", "healer", "Herbal Hawker", "herbal_hawker", "Herbal Heal", 11, 90, 80),
      mk("B-tank", "B", "tank", "Iron Iya", "iron_iya", "Guard Up", 38, 84, 110),
      mk("B-dps", "B", "dps", "Gen Mage", "gen_mage", "Spark Blast", 23, 68, 75),
      mk("B-healer", "B", "healer", "Native Doctor", "native_doctor", "Herbal Heal", 11, 90, 80),
    ],
    turn: 0,
    cursor,
    log: "Two teams of three. Each fighter has a job!",
    texts: [],
    winner: null,
    holdTicks: 0,
  };
}

const randInt = (rnd: Rnd, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

function pick<T>(rnd: Rnd, list: T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))]!;
}

/** Advances the demo by one action. Pure: returns a new Sim. */
export function stepMatch(prev: Sim, rnd: Rnd): Sim {
  // Winner banner is showing: wait a few beats, then start a fresh match.
  if (prev.winner) {
    return prev.holdTicks <= 1 ? createMatch(Math.floor(rnd() * ORDER.length)) : { ...prev, holdTicks: prev.holdTicks - 1 };
  }

  const turn = prev.turn + 1;
  const units = prev.units.map((u) => ({ ...u }));
  const byId = (id: string) => units.find((u) => u.id === id)!;

  // Find the next fighter who is still standing.
  let cursor = prev.cursor;
  let actor: SimUnit | undefined;
  for (let i = 0; i < ORDER.length; i++) {
    const candidate = byId(ORDER[(cursor + i) % ORDER.length]!);
    if (candidate.alive) {
      actor = candidate;
      cursor = (cursor + i + 1) % ORDER.length;
      break;
    }
  }
  if (!actor) return prev;

  const enemies = units.filter((u) => u.side !== actor.side && u.alive);
  const allies = units.filter((u) => u.side === actor.side && u.alive);
  const texts: FloatText[] = [];
  let log = "";
  // After a while, hits keep getting stronger, so a match can never stall and ends in about 25 seconds.
  const rage = 1 + Math.max(0, turn - 20) * 0.1;

  const say = (target: SimUnit, text: string, kind: FloatText["kind"]) =>
    texts.push({ id: turn * 10 + texts.length, x: target.x, y: target.y - 30, text, kind });

  const strike = (target: SimUnit, amount: number, crit: boolean) => {
    const dmg = Math.max(1, Math.round(amount * rage));
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    target.hp = Math.max(0, target.hp - (dmg - absorbed));
    target.fx = { kind: "hurt", id: turn };
    say(target, crit ? `CRIT ${dmg}` : `-${dmg}`, crit ? "crit" : "dmg");
    if (target.hp === 0) {
      target.alive = false;
      target.shield = 0;
      target.fx = { kind: "dead", id: turn };
      say(target, "KO!", "ko");
      return `${target.name} is knocked out!`;
    }
    return "";
  };

  actor.fx = { kind: "lunge", id: turn };

  if (actor.role === "healer") {
    const hurt = allies.filter((u) => u.hp < u.maxHp * 0.7).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      const amount = randInt(rnd, 14, 20);
      hurt.hp = Math.min(hurt.maxHp, hurt.hp + amount);
      hurt.fx = { kind: "heal", id: turn };
      say(hurt, `+${amount}`, "heal");
      log = `${actor.name} heals ${hurt.name}!`;
    } else {
      const target = pick(rnd, enemies);
      const ko = strike(target, randInt(rnd, 6, 10), false);
      log = `${actor.name} pokes ${target.name}. ${ko}`;
    }
  } else if (actor.role === "tank") {
    if (rnd() < 0.4 && actor.shield === 0) {
      actor.shield = 24;
      actor.fx = { kind: "shield", id: turn };
      say(actor, "SHIELD", "shield");
      log = `${actor.name} uses ${actor.move}! A shield blocks hits.`;
    } else {
      const target = enemies.find((u) => u.role === "tank") ?? pick(rnd, enemies);
      const ko = strike(target, randInt(rnd, 13, 19), false);
      log = `${actor.name} shoves ${target.name}. ${ko}`;
    }
  } else {
    const weakest = [...enemies].sort((a, b) => a.hp - b.hp)[0]!;
    const target = rnd() < 0.65 ? weakest : pick(rnd, enemies);
    const crit = rnd() < 0.18;
    const ko = strike(target, randInt(rnd, 28, 40) * (crit ? 1.5 : 1), crit);
    log = `${actor.name} uses ${actor.move} on ${target.name}! ${ko}`;
  }

  const aAlive = units.some((u) => u.side === "A" && u.alive);
  const bAlive = units.some((u) => u.side === "B" && u.alive);
  const winner: Side | null = !aAlive ? "B" : !bAlive ? "A" : null;

  return {
    units,
    turn,
    cursor,
    log: log.trim(),
    texts: [...prev.texts, ...texts].slice(-8),
    winner,
    holdTicks: winner ? 6 : 0,
  };
}
