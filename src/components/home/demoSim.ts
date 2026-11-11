import type { BattleEndPayload, BattleEvent, BattleStartPayload, Role, Side, UnitMeta } from "@/lib/battle";

/*
 * The homepage demo. It is NOT the real engine (that runs on the server and decides every real match):
 * it is a small stand-in that speaks the same event language, so the demo is drawn by the very same
 * arena the real matches use and shows the real structure: two teams of three walking around a
 * street with obstacles, tanks up front and healers behind, red danger circles you can dodge,
 * stuns, and the ring that closes in at sudden death.
 */

const W = 48;
const H = 24;
const R = 1.2;
const CLOCK = { regularMs: 20_000, shrinkMs: 8_000, minRadius: 1, capMs: 35_000 };
const OBSTACLES = [
  { id: "p1", x: 24, y: 7.6, r: 1.8, kind: "pillar" as const },
  { id: "p2", x: 24, y: 16.4, r: 1.8, kind: "pillar" as const },
];

type Rnd = () => number;
type Skill = UnitMeta["skills"][number];

const basicMelee: Skill = { index: 0, name: "Strike", kind: "damage", damageType: "physical", cooldownMs: 1100, staminaCost: 0, range: 2 };
const basicBolt: Skill = { index: 0, name: "Bolt", kind: "damage", damageType: "magical", cooldownMs: 1100, staminaCost: 0, range: 8 };
const slam: Skill = { index: 1, name: "Power Slam", kind: "damage", damageType: "physical", cooldownMs: 7000, staminaCost: 15, range: 2, telegraphMs: 1200, radius: 2.6, stunMs: 800, knockback: 3 };
const heal: Skill = { index: 1, name: "Heal Pulse", kind: "heal", damageType: "magical", cooldownMs: 5500, staminaCost: 12, range: 8 };

interface Def {
  id: string;
  side: Side;
  name: string;
  sprite: string;
  role: Role;
  hp: number;
  atk: number;
  spd: number;
  skills: Skill[];
  x: number;
  y: number;
}

/** Team 1 starts on the left. Team 2 is the exact mirror image, as in real matches. */
const ROSTER: Def[] = [
  { id: "a-tank", side: 1, name: "Danfo Guard", sprite: "danfo_guard", role: "tank", hp: 135, atk: 9, spd: 6, skills: [basicMelee, slam], x: 9, y: 12 },
  { id: "a-dps", side: 1, name: "Gen Mage", sprite: "gen_mage", role: "dps", hp: 72, atk: 9, spd: 9, skills: [basicBolt], x: 6.5, y: 6.6 },
  { id: "a-heal", side: 1, name: "Herbal Hawker", sprite: "herbal_hawker", role: "healer", hp: 90, atk: 6, spd: 7, skills: [basicBolt, heal], x: 4, y: 17.4 },
  { id: "b-tank", side: 2, name: "Iron Iya", sprite: "iron_iya", role: "tank", hp: 125, atk: 9, spd: 6, skills: [basicMelee, slam], x: W - 9, y: 12 },
  { id: "b-dps", side: 2, name: "Molue Mauler", sprite: "molue_mauler", role: "dps", hp: 105, atk: 16, spd: 10, skills: [basicMelee, slam], x: W - 6.5, y: 6.6 },
  { id: "b-heal", side: 2, name: "Native Doctor", sprite: "native_doctor", role: "healer", hp: 90, atk: 6, spd: 7, skills: [basicBolt, heal], x: W - 4, y: 17.4 },
];

const ARMOR: Record<Role, { physical: number; magical: number }> = {
  tank: { physical: 0.8, magical: 1.25 },
  dps: { physical: 1, magical: 1 },
  healer: { physical: 1.2, magical: 0.8 },
};

interface U extends Def {
  maxHp: number;
  alive: boolean;
  nextBasic: number;
  nextSpecial: number;
  stunUntil: number;
  zone: { id: number; x: number; y: number; resolveAt: number } | null;
  dodge: { at: number; x: number; y: number } | null;
  moved: boolean;
}

/** Demo fights should end in about 20 seconds, so hits are tuned up compared with the real engine. */
const DMG = 1.8;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class DemoSim {
  readonly matchId: string;
  t = 0;
  finished = false;
  winner: Side | null = null;
  private units: U[];
  private zoneSeq = 1;
  private warned = false;
  private sudden = false;
  private nextRing = 0;

  constructor(private rnd: Rnd, n: number) {
    this.matchId = `demo-${n}`;
    // Each demo match tilts toward one team or the other, so it isn't the same winner every loop.
    const tilt = { 1: 0.8 + rnd() * 0.2, 2: 1 + rnd() * 0.5 };
    this.units = ROSTER.map((d) => ({
      ...d,
      hp: Math.round(d.hp * tilt[d.side]),
      maxHp: Math.round(d.hp * tilt[d.side]),
      alive: true,
      nextBasic: 600 + rnd() * 500,
      nextSpecial: 3000 + rnd() * 3000,
      stunUntil: 0,
      zone: null,
      dodge: null,
      moved: false,
    }));
  }

  startPayload(): BattleStartPayload {
    const metas: UnitMeta[] = this.units.map((u) => ({
      id: u.id, side: u.side, name: u.name, role: u.role, spriteKey: u.sprite, grade: null, level: 1, spd: u.spd, controlled: false, skills: u.skills,
    }));
    return {
      matchId: this.matchId,
      difficulty: "hustler",
      yourSide: 1,
      controlledUnitId: null,
      tickMs: 100,
      units: metas,
      snapshot: {
        timeMs: 0,
        arena: { w: W, h: H },
        stances: { 1: "neutral", 2: "neutral" },
        finished: false,
        winnerSide: null,
        layout: "gate",
        obstacles: OBSTACLES,
        clock: CLOCK,
        units: this.units.map((u) => ({
          id: u.id, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, energy: 100, maxEnergy: 100, shield: 0, alive: true, stunMs: 0, manual: false, windup: null, cooldowns: u.skills.map(() => 0),
        })),
      },
    };
  }

  endPayload(): BattleEndPayload {
    return { matchId: this.matchId, result: this.winner === 1 ? "win" : "loss", winnerSide: this.winner, durationMs: this.t, damageDealt: 0, reward: null };
  }

  step(dt = 100): BattleEvent[] {
    if (this.finished) return [];
    this.t += dt;
    const t = this.t;
    const ev: BattleEvent[] = [];
    for (const u of this.units) u.moved = false;

    this.ring(ev);
    for (const u of this.order()) {
      if (!u.alive || this.finished) continue;
      if (u.zone) {
        if (t >= u.zone.resolveAt) this.resolveSlam(u, ev);
        continue;
      }
      if (t < u.stunUntil) continue;
      if (!this.act(u, ev)) this.walk(u, dt);
    }
    this.separate();
    const moved = this.units.filter((u) => u.alive && u.moved).map((u) => ({ id: u.id, x: round(u.x), y: round(u.y) }));
    if (moved.length) ev.push({ t, type: "move", units: moved });
    return ev;
  }

  private order(): U[] {
    return [...this.units].sort(() => this.rnd() - 0.5);
  }
  private foes(u: U) {
    return this.units.filter((o) => o.alive && o.side !== u.side);
  }
  private friends(u: U) {
    return this.units.filter((o) => o.alive && o.side === u.side);
  }

  /** Returns true if the fighter spent this tick acting (so it stands still). */
  private act(u: U, ev: BattleEvent[]): boolean {
    const t = this.t;
    const foes = this.foes(u);
    if (!foes.length) return false;
    const reach = (s: Skill) => s.range + R * 2;
    const special = u.skills[1];

    if (u.role === "healer" && special?.kind === "heal" && t >= u.nextSpecial) {
      const hurt = this.friends(u).filter((f) => f.hp < f.maxHp * 0.7).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt && dist(u, hurt) <= reach(special)) {
        u.nextSpecial = t + special.cooldownMs;
        const amount = Math.min(hurt.maxHp - hurt.hp, 16 + Math.round(this.rnd() * 6));
        hurt.hp += amount;
        ev.push({ t, type: "cast", actorId: u.id, skill: "heal-pulse", skillIndex: 1, targetIds: [hurt.id] });
        ev.push({ t, type: "heal", sourceId: u.id, targetId: hurt.id, amount, hp: hurt.hp });
        return true;
      }
    }

    if (special?.telegraphMs && t >= u.nextSpecial) {
      const target = nearest(u, foes);
      if (target && dist(u, target) <= reach(special)) {
        u.nextSpecial = t + special.cooldownMs;
        const id = this.zoneSeq++;
        u.zone = { id, x: target.x, y: target.y, resolveAt: t + special.telegraphMs };
        ev.push({ t, type: "telegraph", id, actorId: u.id, skill: "power-slam", skillIndex: 1, x: target.x, y: target.y, radius: special.radius ?? 2.6, durationMs: special.telegraphMs });
        // Every fighter in the circle gets a chance to read it and run out in time.
        for (const f of foes) {
          if (dist(f, u.zone) > (special.radius ?? 2.6)) continue;
          if (this.rnd() < (f.side === 1 ? 0.6 : 0.5)) {
            const away = unit(f.x - u.zone.x, f.y - u.zone.y);
            const out = (special.radius ?? 2.6) + 0.8;
            f.dodge = { at: t + 300 + this.rnd() * 250, x: clamp(u.zone.x + away.x * out, R, W - R), y: clamp(u.zone.y + away.y * out, R, H - R) };
          }
        }
        return true;
      }
    }

    if (t >= u.nextBasic) {
      const basic = u.skills[0];
      const target = u.role === "dps" ? [...foes].sort((a, b) => a.hp - b.hp)[0]! : nearest(u, foes)!;
      if (dist(u, target) <= reach(basic)) {
        u.nextBasic = t + basic.cooldownMs * (0.9 + this.rnd() * 0.3);
        ev.push({ t, type: "cast", actorId: u.id, skill: "basic", skillIndex: 0, targetIds: [target.id] });
        this.hit(u, target, u.atk, basic.damageType, ev);
        return false; // it can keep walking: basic attacks don't root anyone
      }
    }
    return false;
  }

  private hit(src: U, target: U, base: number, type: "physical" | "magical" | "none", ev: BattleEvent[]) {
    const mult = type === "none" ? 1 : ARMOR[target.role][type];
    const amount = Math.max(1, Math.round(base * DMG * mult * (0.9 + this.rnd() * 0.2)));
    target.hp = Math.max(0, target.hp - amount);
    ev.push({ t: this.t, type: "damage", sourceId: src.id, targetId: target.id, amount, absorbed: 0, hp: target.hp, mult });
    if (target.hp <= 0) this.kill(target, ev);
  }

  private kill(u: U, ev: BattleEvent[]) {
    u.alive = false;
    u.zone = null;
    ev.push({ t: this.t, type: "death", unitId: u.id });
    for (const side of [1, 2] as Side[]) {
      if (!this.units.some((o) => o.alive && o.side === side)) {
        this.finished = true;
        this.winner = side === 1 ? 2 : 1;
        ev.push({ t: this.t, type: "end", winnerSide: this.winner });
        return;
      }
    }
  }

  private resolveSlam(u: U, ev: BattleEvent[]) {
    const z = u.zone!;
    u.zone = null;
    const special = u.skills[1];
    const radius = special.radius ?? 2.6;
    ev.push({ t: this.t, type: "burst", id: z.id, actorId: u.id, x: z.x, y: z.y, radius });
    for (const f of this.foes(u)) {
      if (dist(f, z) > radius) continue; // dodged: it is simply not in the circle any more
      this.hit(u, f, u.atk * 2.2, "physical", ev);
      if (!f.alive) continue;
      f.stunUntil = this.t + (special.stunMs ?? 800);
      ev.push({ t: this.t, type: "stun", sourceId: u.id, targetId: f.id, durationMs: special.stunMs ?? 800 });
      const away = unit(f.x - z.x, f.y - z.y);
      const fromX = f.x;
      const fromY = f.y;
      f.x = clamp(f.x + away.x * 2, R, W - R);
      f.y = clamp(f.y + away.y * 2, R, H - R);
      ev.push({ t: this.t, type: "displace", unitId: f.id, x: round(f.x), y: round(f.y), fromX, fromY });
    }
  }

  /** Where this fighter wants to stand, following the real roles: tanks lead, healers hang back, mages kite. */
  private goal(u: U): { x: number; y: number } | null {
    const foes = this.foes(u);
    if (!foes.length) return null;
    const centre = { x: W / 2, y: H / 2 };
    if (this.sudden && dist(u, centre) > this.ringRadius() - 1.5) return centre;
    if (u.dodge && this.t >= u.dodge.at) return u.dodge;
    const dir = u.side === 1 ? 1 : -1;
    if (u.role === "healer") {
      const tank = this.friends(u).find((f) => f.role === "tank");
      const near = nearest(u, foes)!;
      if (dist(u, near) < 6) return { x: u.x - dir * 3, y: u.y + (u.y < H / 2 ? 2 : -2) };
      return tank ? { x: tank.x - dir * 4.5, y: tank.y + (u.y < tank.y ? -2.5 : 2.5) } : null;
    }
    const target = nearest(u, foes)!;
    const reach = u.skills[0].range + R * 2;
    const d = dist(u, target);
    if (u.skills[0].range >= 6) {
      if (d < 6) return { x: u.x - dir * 3, y: u.y + (u.y < H / 2 ? 2 : -2) };
      if (d <= reach - 0.5) return null;
    } else if (d <= reach - 0.4) return null;
    // Aim a little to the side of the target so a team spreads across it instead of stacking.
    const fan = (u.side === 1 ? 1 : -1) * (u.role === "dps" ? 1.2 : -1.2);
    return { x: target.x - dir * (reach - 0.8), y: target.y + fan };
  }

  private walk(u: U, dt: number) {
    const g = this.goal(u);
    if (!g) return;
    const d = dist(u, g);
    if (d < 0.05) return;
    const step = Math.min(d, (3 + u.spd * 0.15) * (dt / 1000));
    let nx = u.x + ((g.x - u.x) / d) * step;
    let ny = u.y + ((g.y - u.y) / d) * step;
    // Slide around pillars instead of walking through them.
    for (const o of OBSTACLES) {
      const od = Math.hypot(nx - o.x, ny - o.y);
      const min = o.r + R;
      if (od < min) {
        const side = ny >= o.y ? 1 : -1;
        nx = o.x + ((nx - o.x) / (od || 1)) * min;
        ny = o.y + ((ny - o.y) / (od || 1)) * min + side * 0.02;
      }
    }
    u.x = clamp(nx, R, W - R);
    u.y = clamp(ny, R, H - R);
    u.moved = true;
  }

  private separate() {
    const live = this.units.filter((u) => u.alive);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i];
          const b = live[j];
          const d = dist(a, b);
          if (d >= R * 2 || d === 0) continue;
          const push = (R * 2 - d) / 2;
          const ux = (a.x - b.x) / d;
          const uy = (a.y - b.y) / d;
          a.x = clamp(a.x + ux * push, R, W - R);
          a.y = clamp(a.y + uy * push, R, H - R);
          b.x = clamp(b.x - ux * push, R, W - R);
          b.y = clamp(b.y - uy * push, R, H - R);
          a.moved = b.moved = true;
        }
      }
    }
  }

  private ringRadius() {
    const start = Math.hypot(W / 2, H / 2) + 1;
    const p = Math.min(1, Math.max(0, (this.t - CLOCK.regularMs) / CLOCK.shrinkMs));
    return start + (CLOCK.minRadius - start) * p;
  }

  private ring(ev: BattleEvent[]) {
    const t = this.t;
    if (!this.warned && t >= CLOCK.regularMs - 10_000) {
      this.warned = true;
      ev.push({ t, type: "phase", phase: "warning" });
    }
    if (!this.sudden && t >= CLOCK.regularMs) {
      this.sudden = true;
      this.nextRing = t + 1000;
      ev.push({ t, type: "phase", phase: "sudden_death" });
    }
    if (!this.sudden || t < this.nextRing) return;
    this.nextRing += 1000;
    const r = this.ringRadius();
    const pct = 0.03 + 0.07 * Math.min(1, (t - CLOCK.regularMs) / CLOCK.shrinkMs);
    for (const u of this.units) {
      if (!u.alive || this.finished || dist(u, { x: W / 2, y: H / 2 }) <= r) continue;
      const amount = Math.max(1, Math.round(u.maxHp * pct));
      u.hp = Math.max(0, u.hp - amount);
      ev.push({ t, type: "damage", sourceId: "ring", targetId: u.id, amount, absorbed: 0, hp: u.hp, ring: true });
      if (u.hp <= 0) this.kill(u, ev);
    }
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const unit = (x: number, y: number) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
};
const nearest = (u: U, list: U[]) => [...list].sort((a, b) => dist(u, a) - dist(u, b))[0];
