"use client";

import { Music, floorTrack } from "@/components/Music";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState, type PointerEvent } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { FX_COLS, FX_ROWS, mobScale } from "@/lib/sprites/designs";
import { artOf, type FxArt } from "@/lib/skill-art";
import type { GuildFighter } from "@/lib/guild";
import type { EquippedSkill } from "@/lib/starter-pack";
import { findPath, buildNav, clearLine, nearestWalkable, walkable, type Pt } from "@/lib/guild-nav";
import type { Stance } from "@/lib/battle";
import { clearExpedition, partySig, readExpedition, writeExpedition } from "@/lib/world/expedition";
import { RULES, START_MOVING, STANCES, STOP_MOVING, STROLL_SPEED, arriveEase, strollGoal, sway } from "@/lib/world/stance";
import { ROLE_RANK, angleDiff, formationOffset, ringPoint, separate, spawnPlan } from "@/lib/world/party";
import { ZOOM } from "@/lib/world/zoom";
import { restedFrac } from "@/lib/rest";
import { ApiError, gameApi } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { MAX_FLOOR, TILE_SRC, baseMobCount, generateFloor, isBossFloor, rollMob, type Floor } from "@/lib/world/floor";

const T = 34 * ZOOM; // one tile on screen, in px (smaller = more of the map in view)
const FRAME = 2.7 / ZOOM; // a sprite frame, in tiles (sprites keep their on-screen size however far the map is zoomed)
const S = T / ZOOM; // one sprite-sized unit, in px
const EDGE = 44; // px from the screen edge where the camera starts to scroll
const SPEED = 3.1;
const MOB_SPEED = 2.3;
/** How fast each kind ambles about when nobody is near (tiles per second) and how long it rests between walks (s). */
const WANDER: Record<string, { speed: number; rest: [number, number] }> = {
  slime: { speed: 0.7, rest: [2, 6] }, bat: { speed: 1.7, rest: [0.4, 1.6] }, mushroom: { speed: 0.6, rest: [3, 7] },
  goblin: { speed: 1.1, rest: [1.5, 5] }, direwolf: { speed: 1.5, rest: [1, 4] }, golem: { speed: 0.5, rest: [3, 8] },
};
const LEASH = 14; // the farthest any mob will go from home
/**
 * How mobs react, by floor. Low floors are calm: mobs ignore you until you hit them, and give up quickly once
 * you walk away. Higher floors notice you from further off and chase for longer. Kinds differ a little
 * (slimes and mushrooms are placid, wolves are edgy); bosses guard their ring at every floor.
 */
const TEMPER: Record<string, number> = { slime: 0.5, mushroom: 0.5, golem: 0.8, goblin: 1.1, bat: 1.2, direwolf: 1.4 };
/** Distance at which an unprovoked mob goes for you (tiles). Floors 1-2: never. */
const aggroRange = (floor: number, kind: string, boss: boolean) => {
  if (boss) return 6;
  const base = floor <= 2 ? 0 : floor <= 10 ? 1.5 + (floor - 3) * 0.35 : Math.min(6.5, 4 + (floor - 11) * 0.1);
  return base * (TEMPER[kind] ?? 1);
};
/** How far from home it will chase, and how far its target can get before it gives up. */
const chaseRange = (floor: number, boss: boolean) => (boss ? LEASH : Math.min(LEASH, 3 + 0.3 * floor));
const loseRange = (floor: number, boss: boolean) => (boss ? 14 : 4 + 0.2 * floor);
/** A walkable spot at least four tiles from a pillar, on the side facing into the map, so nobody arrives standing in the light. */
function clearOfLight(nav: Parameters<typeof nearestWalkable>[0], gate: [number, number], dir: 1 | -1, off: [number, number]): Pt {
  let best: Pt = nearestWalkable(nav, gate[0] + dir * 5 + off[0], gate[1] + off[1]);
  let bd = Math.hypot(best[0] - gate[0], best[1] - gate[1]);
  for (const r of [4.6, 5.2, 5.8, 6.4, 7]) {
    for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      const to = nearestWalkable(nav, gate[0] + dir * Math.cos(a) * r + off[0], gate[1] + Math.sin(a) * r * 0.8 + off[1]);
      const d = Math.hypot(to[0] - gate[0], to[1] - gate[1]);
      if (d >= 4) return to;
      if (d > bd) { best = to; bd = d; }
    }
  }
  return best;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A special skill a fighter fires on its own whenever it is ready, has the energy and the moment is right. */
interface FSkill { name: string; kind: string; type: string; power: number; cd: number; cost: number; all: boolean; weakest: boolean; area: boolean; ready: number }
const toFSkill = (s: EquippedSkill): FSkill => {
  const d = (s.description ?? "").toLowerCase();
  return {
    name: s.name, kind: s.kind ?? "damage", type: s.damage_type ?? "physical", power: s.power ?? 1, cd: s.cooldown_ms ?? 8000, cost: s.stamina_cost ?? 10, ready: 0,
    all: /every ally|all allies|every enemy|all enemies|earshot/.test(d), weakest: /weakest|most (hurt|wounded)/.test(d), area: /area|rain of|every enemy/.test(d),
  };
};

const makeAg = (side: Ag["side"], p: Partial<Ag> & Pick<Ag, "id" | "sprite" | "name" | "level" | "x" | "y" | "hp" | "atk" | "def" | "kind">): Ag => ({
  role: "dps", max: p.hp, magic: 0, skills: [], en: 0, maxEn: 0, regen: 0, gcd: 0, shield: 0, shieldUntil: 0, buffUntil: 0, weakUntil: 0, dodge: 0, path: [], target: null, cd: 0, repath: 0, dead: false, boss: false, held: false, provoked: false,
  look: { rest: "idle", flip: false, act: null, n: 0 }, side,
  slot: 0, speedMul: 1, delay: 0, sway: [0, 0], swayAt: 0, angle: Math.random() * Math.PI * 2, home: [p.x, p.y, 2], wanderAt: 0, born: -1e9, deadAt: 0,
  movedAt: 0, skipId: "", skipUntil: 0,
  ...p,
});

const depth = (y: number) => 10 + Math.round(y * 10);

/** One fighter or mob. Its position and state are updated by the loop, so moving costs no React renders. */
interface Ag {
  id: string;
  side: "ally" | "foe";
  sprite: string;
  role: "tank" | "healer" | "dps";
  name: string;
  level: number;
  x: number; y: number;
  hp: number; max: number; atk: number; def: number;
  /** Fighters only: the magic stat, the equipped skills (slots 2-5), and the energy they spend. */
  magic: number; skills: FSkill[]; en: number; maxEn: number; regen: number; gcd: number;
  /** Temporary effects (times are in ms on the loop clock). */
  shield: number; shieldUntil: number; buffUntil: number; weakUntil: number; dodge: number;
  path: Pt[];
  target: Ag | null;
  cd: number;
  repath: number;
  dead: boolean;
  boss: boolean;
  kind: string;
  /** Allies: walking where the player told them, ignoring foes until they arrive. */
  held: boolean;
  look: { rest: "idle" | "walk" | "stun"; flip: boolean; act: "attack" | "hurt" | null; n: number };
  key?: string;
  lvEl?: HTMLElement | null;
  /** Overlay layer above every tree and fighter: health bar, level tag, floating text. */
  fx?: HTMLDivElement | null;
  setLook?: (l: Ag["look"]) => void;
  el?: HTMLDivElement | null;
  bar?: HTMLDivElement | null;
  hpEl?: HTMLDivElement | null;
  /** Allies: place in the formation (0 leads). */
  slot: number;
  /** Walking pace relative to the others, so a group never moves in lockstep. */
  speedMul: number;
  /** Allies: a short reaction delay before setting off when told to move (seconds). */
  delay: number;
  /** Allies: a small, slowly changing drift from their slot, so the formation stays loose. */
  sway: Pt; swayAt: number;
  /** Where on the ring around its target this fighter likes to stand. */
  angle: number;
  /** Mobs: the patch of ground it lives on, and when it next wanders (ms; Infinity while walking). */
  home: [number, number, number]; wanderAt: number;
  born: number; deadAt: number;
  /** When it last moved (ms), so the walk animation does not flicker on and off between short hops. */
  movedAt: number;
  /** A foe it could not find a way to, left alone until `skipUntil` (ms). */
  skipId: string; skipUntil: number;
  /** Foes: it was hit by one of ours, so it fights back whatever the floor's temper. */
  provoked: boolean;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Colour of a monster's tag, by how far it is above the party's best fighter: ordinary ones stay plain, tougher ones warn. */
const levelTone = (gap: number) => (gap >= 5 ? "text-ember" : gap >= 2 ? "text-gold" : "text-paper");
const MOB_NAME: Record<string, string> = { direwolf: "Dire Wolf" };
const mobName = (kind: string) => MOB_NAME[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);

function Unit({ a, party }: { a: Ag; party: number }) {
  const [look, setLook] = useState(a.look);
  // Bosses are drawn large on purpose; everything else is scaled to a realistic size next to a fighter.
  const size = FRAME * T * (a.boss ? 1.5 : mobScale(a.sprite));
  const box = { width: size, height: size, marginLeft: -size / 2, marginTop: -size * 0.86 };
  return (
    <>
      <div ref={(el) => { a.el = el; a.setLook = setLook; }} className="absolute left-0 top-0 will-change-transform" style={box}>
        <FighterSprite
          spriteKey={a.sprite} role={a.role} flip={look.flip} rest={look.rest}
          action={look.act} actionKey={look.n}
        />
      </div>
      {/* Drawn on its own layer so a tree or another fighter in front can never cover the bar, the tag or a level-up. */}
      <div ref={(el) => { a.fx = el; }} className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ ...box, zIndex: 9000 }}>
        <div className="absolute left-1/2 top-0 h-1.5 w-[max(50%,26px)] -translate-x-1/2 -translate-y-1 bg-ink/80" ref={(el) => { a.bar = el; }}>
          <div ref={(el) => { a.hpEl = el; }} className={a.side === "ally" ? "h-full w-full bg-leaf" : "h-full w-full bg-ember"} />
          <span
            className={`absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-bold leading-none ${a.side === "foe" ? levelTone(a.level - party) : "text-steel"}`}
            style={{ textShadow: "0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}
          >
            <span ref={(el) => { a.lvEl = el; }}>Lv {a.level}</span>{a.side === "foe" ? ` ${mobName(a.kind)}` : ""}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * An adventure floor: a fixed map seen from above. The camera follows the party; push the pointer (or a
 * finger) against a screen edge to look around, and an arrow points back to the fighters. Tap the ground to
 * send the party there, tap a foe to focus it. Otherwise they fight on their own.
 *
 * Combat here runs in the browser and reports kills to the server, which checks the floor is unlocked and
 * pays XP. A fully server-run version comes with shared rooms.
 */
export function FloorScreen({ floorNo, fighters, tutorialStep, players = 1, floorUnlocked = 1, arriveFromAbove = false }: { floorNo: number; /** Came down from the floor above: the party appears beside the way up instead of by the way in. */ arriveFromAbove?: boolean; fighters: GuildFighter[]; tutorialStep: number; /** Highest floor the player may enter (from the server). */ floorUnlocked?: number; /** People on this floor right now; more of them means more mobs and quicker arrivals. */ players?: number }) {
  const floor = useMemo(() => generateFloor(floorNo), [floorNo]);
  const [run, setRun] = useState(0); // bump to retry
  const [revived, setRevived] = useState(false);
  // After a defeat the party starts again at a quarter of its health.
  const squadIn = useMemo(() => (revived ? fighters.map((f) => ({ ...f, hp_frac: 0.25, hp_at: undefined })) : fighters), [revived, fighters]);
  return <FloorMap key={run} floor={floor} fighters={squadIn} tutorialStep={tutorialStep} players={players} floorUnlocked={floorUnlocked} fromAbove={arriveFromAbove} retry={() => { setRevived(true); setRun((r) => r + 1); }} />;
}

function FloorMap({ floor, fighters, tutorialStep, players, floorUnlocked, fromAbove, retry }: { floor: Floor; fighters: GuildFighter[]; tutorialStep: number; players: number; floorUnlocked: number; fromAbove: boolean; retry: () => void }) {
  const router = useRouter();
  const [askBack, setAskBack] = useState(false);
  const [askNext, setAskNext] = useState(false);
  const nav = useMemo(() => buildNav(floor.nav), [floor]);
  const squad = useMemo(() => {
    const team = fighters.filter((f) => f.team_slot > 0).sort((a, b) => (a.team_slot ?? 0) - (b.team_slot ?? 0));
    return (team.length ? team : fighters).slice(0, 3);
  }, [fighters]);

  const allies = useRef<Ag[]>([]);
  const foes = useRef<Ag[]>([]);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"play" | "lost">("play");
  /** The party's best level, which colours the level tags over monsters; rises when someone levels up. */
  const [partyLvl, setPartyLvl] = useState(() => Math.max(1, ...fighters.filter((f) => f.team_slot > 0).map((f) => f.level)));
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const progress = useRef({ kills: 0, boss: false, gate: false as false | "back" | "next", unlocked: false, next: 0, heading: 0, anchor: [0, 0] as Pt, strollAt: 0, strolling: false, left: false });
  const [stance, setStanceState] = useState<Stance>("neutral");
  const stanceRef = useRef<Stance>("neutral");
  const [free, setFree] = useState(false); // camera detached from the party

  const view = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const ground = useRef<HTMLCanvasElement>(null);
  const cam = useRef({ x: 0, y: 0, free: false, px: -1, py: -1, vw: 800, vh: 600 });
  const marker = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Tell the server this floor has been reached (counts toward "Reach Floor N" quests).

  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const firstDone = useRef(false);
  const [firstJobDone, setFirstJobDone] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  };
  interface JobState {
    quests: { slug: string; title: string; objs: { idx: number; kind: string; item: string | null; qty: number }[] }[];
    prog: Record<string, number>; items: Record<string, number>; done: Set<string>; reached: number;
    have: (slug: string, o: { idx: number; kind: string; item: string | null; qty: number }, reached: number) => number;
    check?: () => void;
  }
  const jobs = useRef<JobState | null>(null);
  /** Tells the player the moment a job they took is finished (only then, and only for a few seconds). */
  const checkJobs = () => {
    const j = jobs.current;
    if (!j) return;
    for (const q of j.quests) {
      if (j.done.has(q.slug) || !q.objs.length) continue;
      if (q.objs.every((o) => j.have(q.slug, o, j.reached) >= o.qty)) { j.done.add(q.slug); showToast(`Job complete: ${q.title}. Hand it in at the job board.`); }
    }
  };
  const noteKill = (res: { quests?: { slug: string; idx: number; progress: number }[]; drops?: { slug: string; qty: number }[] } | null) => {
    const j = jobs.current;
    if (!j || !res) return;
    for (const u of res.quests ?? []) j.prog[`${u.slug}:${u.idx}`] = u.progress;
    for (const d of res.drops ?? []) j.items[d.slug] = (j.items[d.slug] ?? 0) + d.qty;
    checkJobs();
  };

  // Supabase calls only run once awaited, so this is an async block.
  useEffect(() => {
    let live = true;
    (async () => {
      const sb = createClient();
      const { data: prof } = await sb.from("profiles").select("floor_reached").single();
      try { await gameApi("/floor/enter", { floor: floor.n }); } catch { /* kills retry the entry themselves */ }
      const [pq, qs, os, pp, inv] = await Promise.all([
        sb.from("player_quests").select("quest_slug").eq("status", "active"),
        sb.from("quests").select("slug, title"),
        sb.from("quest_objectives").select("quest_slug, idx, kind, item_slug, qty"),
        sb.from("player_quest_progress").select("quest_slug, idx, progress"),
        sb.from("player_items").select("item_slug, qty"),
      ]);
      if (!live) return;
      const taken = new Set((pq.data ?? []).map((r) => r.quest_slug as string));
      const items: Record<string, number> = Object.fromEntries((inv.data ?? []).map((r) => [r.item_slug as string, r.qty as number]));
      const prog: Record<string, number> = Object.fromEntries((pp.data ?? []).map((r) => [`${r.quest_slug}:${r.idx}`, r.progress as number]));
      const reachedBefore = (prof?.floor_reached as number | undefined) ?? 0;
      const quests = (qs.data ?? []).filter((q) => taken.has(q.slug as string)).map((q) => ({
        slug: q.slug as string, title: q.title as string,
        objs: (os.data ?? []).filter((o) => o.quest_slug === q.slug).map((o) => ({ idx: o.idx as number, kind: o.kind as string, item: o.item_slug as string | null, qty: o.qty as number })),
      }));
      const have = (slug: string, o: { idx: number; kind: string; item: string | null; qty: number }, reached: number) =>
        o.kind === "kill" ? prog[`${slug}:${o.idx}`] ?? 0 : o.kind === "reach" ? reached : Math.min(o.qty, items[o.item ?? ""] ?? 0);
      jobs.current = { quests, prog, items, have, done: new Set(quests.filter((q) => q.objs.length && q.objs.every((o) => have(q.slug, o, reachedBefore) >= o.qty)).map((q) => q.slug)), reached: Math.max(reachedBefore, floor.n) };
      checkJobs();
    })();
    return () => { live = false; };
  }, [floor.n]);

  const sig = useMemo(() => partySig(squad.map((f) => f.id)), [squad]);
  // Keep the expedition's health up to date, and start fresh after a defeat.
  useEffect(() => {
    let lastDb = 0;
    // Health is also kept on the server, so it is still there (and healing) when the player is back in the guild.
    const saveDb = () => {
      const A = allies.current;
      if (!A.length) return;
      gameApi("/floor/hp", { ids: A.map((a) => a.id), fracs: A.map((a) => (a.dead ? 0 : Math.max(0.01, a.hp / a.max))) }, { keepalive: true }).catch(() => { /* the next save will catch up */ });
    };
    const save = () => { if (allies.current.length) { writeExpedition(sig, allies.current); const n = Date.now(); if (n - lastDb > 3000) { lastDb = n; saveDb(); } } };
    const t = setInterval(save, 1000);
    const flush = () => { lastDb = 0; save(); };
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(t); window.removeEventListener("pagehide", flush); flush(); };
  }, [sig]);
  useEffect(() => {
    if (state !== "lost") return;
    clearExpedition();
    // After a defeat the party limps home at a quarter of its health, so "Try again" is not an instant loss.
    gameApi("/floor/hp", { ids: allies.current.map((a) => a.id), fracs: allies.current.map(() => 0.25) }, { keepalive: true }).catch(() => { /* ignore */ });
  }, [state]);

  // Build the two sides once.
  useEffect(() => {
    // Tanks lead, healers trail: that is the order they take in the formation.
    const order = squad.map((f, i) => ({ f, i })).sort((p, q) => ROLE_RANK[p.f.template.role] - ROLE_RANK[q.f.template.role] || p.i - q.i);
    allies.current = order.map(({ f }, slot) => {
      const off = formationOffset(slot, order.length, 0);
      // Beside the light, never inside it: by the white pillar when coming up, by the golden one when coming back down.
      const at = clearOfLight(nav, fromAbove ? [floor.exit[0] + (isBossFloor(floor.n) ? 2.6 : 0), floor.exit[1] + 0.9] : [floor.start[0], floor.start[1] + 0.9], fromAbove ? -1 : 1, off);
      return makeAg("ally", {
        id: f.id, sprite: f.template.sprite_key, role: f.template.role, name: f.template.name, level: f.level,
        x: at[0], y: at[1], hp: f.hp, atk: f.atk, def: f.def, kind: "fighter", slot, speedMul: rnd(0.93, 1.07),
        magic: f.magic, maxEn: f.stamina * 5, en: f.stamina * 5, regen: 2 + f.stamina * 0.2,
        skills: (f.skills ?? []).filter((s) => s.slot >= 2 && s.name && s.kind).sort((x, y) => x.slot - y.slot).map(toFSkill),
      });
    });
    // Health and who is still up carry over from the last floor of this expedition.
    for (const f of squad) {
      const a = allies.current.find((x) => x.id === f.id);
      if (!a || f.hp_frac === undefined) continue;
      const fr = restedFrac(f.hp_frac, f.hp_at);
      if (fr <= 0.001) { a.dead = true; a.hp = 0; a.deadAt = -1e9; a.path = []; } else a.hp = Math.max(1, Math.round(a.max * fr));
    }
    const saved = readExpedition(sig);
    if (saved && allies.current.some((a) => (saved[a.id]?.[0] ?? 1) > 0)) {
      for (const a of allies.current) {
        const sv = saved[a.id];
        if (!sv) continue;
        if (sv[0] <= 0) { a.dead = true; a.hp = 0; a.deadAt = -1e9; a.path = []; }
        else { a.hp = Math.max(1, Math.round(a.max * sv[0])); a.en = Math.round(a.maxEn * sv[1]); }
      }
    }
    const zoneOf = (x: number, y: number): [number, number, number] => {
      let best = floor.zones[0] ?? [x, y, 2], bd = Infinity;
      for (const z of floor.zones) { const d = Math.hypot(z[0] - x, z[1] - y); if (d < bd) { bd = d; best = z; } }
      return best;
    };
    foes.current = floor.mobs.map((m) => {
      const [mx, my] = nearestWalkable(nav, m.x, m.y);
      return makeAg("foe", {
        id: `m${m.id}`, sprite: m.sprite, name: m.kind, level: m.level, x: mx, y: my, hp: m.hp, atk: m.atk, def: m.def, boss: m.boss, kind: m.kind,
        home: m.boss ? [mx, my, 1.5] : zoneOf(mx, my), wanderAt: rnd(0, 3000), speedMul: rnd(0.9, 1.1),
      });
    });
    progress.current.next = performance.now() + 8000;
    progress.current.strollAt = performance.now() + 3500;
    const lead0 = allies.current[0];
    if (lead0) progress.current.anchor = [lead0.x, lead0.y];
    setReady(true);
  }, [floor, squad, nav]);

  // Ground: grass everywhere, then road and water laid on top through a soft mask so edges blend.
  useEffect(() => {
    const c = ground.current;
    if (!c) return;
    const img = new Image();
    img.src = `/world/tiles_${floor.theme.id}.png`;
    img.onload = () => {
      const g = c.getContext("2d")!;
      const { w, h, cells, variant } = floor;
      g.imageSmoothingEnabled = false;
      const [rg, rp, rl] = floor.theme.rows;
      const layer = (kind: number, row: number, mod: number) => {
        const L = document.createElement("canvas");
        L.width = w * T; L.height = h * T;
        const lg = L.getContext("2d")!;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          if (cells[j * w + i] === kind) lg.drawImage(img, (variant[j * w + i] % mod) * TILE_SRC, row * TILE_SRC, TILE_SRC, TILE_SRC, i * T, j * T, T + 1, T + 1);
        }
        // Soft edge: blur a mask of where this layer exists and cut the layer with it.
        const M = document.createElement("canvas");
        M.width = w; M.height = h;
        const mg = M.getContext("2d")!;
        mg.fillStyle = "#fff";
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (cells[j * w + i] === kind) mg.fillRect(i, j, 1, 1);
        const B = document.createElement("canvas");
        B.width = w * T; B.height = h * T;
        const bg = B.getContext("2d")!;
        bg.filter = `blur(${T * 0.22}px)`;
        bg.imageSmoothingEnabled = true;
        bg.drawImage(M, 0, 0, w * T, h * T);
        lg.globalCompositeOperation = "destination-in";
        lg.drawImage(B, 0, 0);
        g.drawImage(L, 0, 0);
      };
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.drawImage(img, variant[j * w + i] * TILE_SRC, rg * TILE_SRC, TILE_SRC, TILE_SRC, i * T, j * T, T + 1, T + 1);
      layer(1, rp, 8);
      layer(2, rl, 4);
    };
  }, [floor]);

  const spawnText = (x: number, y: number, text: string, cls: string, ms = 700, anim = "dmg", extra = "") => {
    const d = document.createElement("div");
    d.textContent = text;
    d.className = `pointer-events-none absolute z-[9000] text-xl font-bold ${cls}`;
    d.style.cssText += `;left:${x * T}px;top:${y * T - 1.6 * S}px;animation:${anim} ${ms}ms ease-out forwards;${extra}`;
    world.current?.appendChild(d);
    setTimeout(() => d.remove(), ms + 20);
  };

  /** A skill animation (a row of an effect sheet) drawn over the floor; `to` makes it fly there as a projectile. */
  const spawnFx = (art: FxArt | null | undefined, x: number, y: number, opts: { ms?: number; to?: [number, number]; loop?: boolean } = {}) => {
    if (!art || !world.current) return;
    const ms = opts.ms ?? 560, px = S * 2.2 * (art.size ?? 1);
    const at = (wx: number, wy: number) => `translate(${wx * T - px / 2}px, ${wy * T - (art.ground ? 0.15 : 0.95) * S - px / 2}px)`;
    const d = document.createElement("div");
    const flip = opts.to && opts.to[0] < x ? " scaleX(-1)" : "";
    d.className = "pointer-events-none absolute left-0 top-0 z-[9000]";
    d.style.cssText += `;width:${px}px;height:${px}px;transform:${at(x, y)}${flip};background:url(/sprites/fx_${art.sheet}.png) 0% ${(art.row / (FX_ROWS - 1)) * 100}%/${FX_COLS * 100}% ${FX_ROWS * 100}% no-repeat;image-rendering:pixelated;animation:spr ${opts.loop ? 420 : ms}ms steps(${FX_COLS}, jump-none) ${opts.loop ? "infinite" : "1 forwards"};--to:100%`;
    world.current.appendChild(d);
    if (opts.to) {
      const [tx, ty] = opts.to;
      requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transition = `transform ${ms}ms linear`; d.style.transform = `${at(tx, ty)}${flip}`; }));
    }
    setTimeout(() => d.remove(), ms + 40);
  };

  // Kills go to the game server, which checks them against what the floor can hold before the database pays out.
  // They are sent in order, each retried a few times so a blip in the connection can't lose one; a server that
  // restarted (no_run) is simply told about the floor again.
  const reports = useRef<Promise<void>>(Promise.resolve());
  const sendKill = (body: { floor: number; kind: string; level: number; boss: boolean }, done?: (data: unknown) => void) => {
    reports.current = reports.current.then(async () => {
      for (let i = 0; i < 3; i++) {
        try { done?.(await gameApi("/floor/kill", body)); return; } catch (e) {
          if (e instanceof ApiError) {
            if (e.code === "no_run") { try { await gameApi("/floor/enter", { floor: body.floor }); } catch { /* retry below */ } continue; }
            if (e.status >= 400 && e.status < 500 && e.status !== 429) return; // refused: retrying won't help
          }
        }
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    });
  };
  // Text that floats up over a fighter's head and walks with them (damage numbers stay where they were struck).
  const overHead = (a: Ag, text: string, cls: string, ms: number, anim = "dmg", extra = "") => {
    const el = a.fx;
    if (!el) return;
    const d = document.createElement("div");
    d.textContent = text;
    d.className = `over-head pointer-events-none absolute text-xl font-bold ${cls}`;
    d.style.cssText += `;animation:${anim} ${ms}ms ease-out forwards;${extra}`;
    el.appendChild(d);
    setTimeout(() => d.remove(), ms + 20);
  };

  // A level-up: a golden aura behind the fighter, a ring spreading on the ground, a glow around their outline, and a
  // big banner overhead. All of it is attached to the fighter, so it follows them if they keep moving.
  const celebrate = (a: Ag, n = 0) => {
    const el = a.el, fx = a.fx;
    if (el && fx) {
      const sprite = (el.firstElementChild as HTMLElement | null) ?? el;
      const glow = document.createElement("div");
      glow.className = "levelup-glow";
      fx.appendChild(glow); // on the top layer, blended in, so nothing in front of the fighter can hide it
      sprite.style.transition = "filter 600ms ease-out";
      sprite.style.filter = "drop-shadow(0 0 3px #fff4b0) drop-shadow(0 0 10px #ffb82e)";
      setTimeout(() => { sprite.style.filter = ""; }, 1300); // eases away while the aura and banner fade
      setTimeout(() => { glow.remove(); sprite.style.transition = ""; }, 2050);
    }
    overHead(a, "LEVEL UP!", "text-gold", 2000, "lvl-pop", `font-size:2rem;letter-spacing:.06em;white-space:nowrap;margin-bottom:${1.6 + n * 2.1}rem;text-shadow:0 0 10px #ffb82e,0 2px 0 #000;`);
  };

  // The server rolls the xp (a range, not a fixed amount) and says what each fighter got: show it over their heads.
  const showXp = (data: unknown) => {
    const res = data as { throttled?: boolean; awards?: { id: string; gained: number; levels_gained: number }[] } | null;
    if (!res?.awards || res.throttled) return;
    let ups = 0; // party members levelling on the same kill take turns, each banner a step higher than the last
    for (const w of res.awards) {
      const a = allies.current.find((u) => u.id === w.id);
      if (!a || w.gained <= 0) continue;
      overHead(a, `+${w.gained} XP`, "text-leaf", 1200);
      if (w.levels_gained > 0) { a.level += w.levels_gained; if (a.lvEl) a.lvEl.textContent = `Lv ${a.level}`; setPartyLvl((p) => Math.max(p, a.level)); const turn = ups++; setTimeout(() => celebrate(a, turn), 250 + turn * 450); }
    }
  };
  const killReport = (m: Ag) => sendKill({ floor: floor.n, kind: m.kind, level: m.level, boss: m.boss }, (data) => {
    showXp(data); noteKill(data as never);
    // The tutorial job is finished by the first bat; it gets the same banner as every other job.
    if (tutorialStep === 8 && floor.n === 1 && m.kind === "bat" && !m.boss && !firstDone.current) { firstDone.current = true; setFirstJobDone(true); showToast("Job complete: First job. Hand it in at the job board."); }
  });

  // The loop: movement, fighting, camera.
  useEffect(() => {
    if (!ready) return;
    let raf = 0, last = performance.now();
    const step = (a: Ag, dt: number, speed: number) => {
      const p = a.path[0];
      if (!p) return false;
      const dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), m = (speed * dt) / ZOOM;
      if (Math.abs(dx) > 0.05) a.look.flip = dx < 0;
      if (d <= m) { a.x = p[0]; a.y = p[1]; a.path.shift(); } else { a.x += (dx / d) * m; a.y += (dy / d) * m; }
      return true;
    };
    let spawnId = 0;
    const hurt = (from: Ag, to: Ag, now: number, mult = 1, magical = false, skill = "Basic Strike") => {
      if (to.dodge > 0) { to.dodge--; spawnText(to.x, to.y, "Dodge", "text-steel"); return; }
      const power = from.side === "ally" ? (magical && from.magic ? from.magic : from.atk) * (now < from.buffUntil ? 1.25 : 1) : from.atk;
      const raw = (from.side === "ally" ? power - to.def * 0.5 : power * (now < from.weakUntil ? 0.7 : 1) - to.def * 0.45) * mult;
      let dmg = Math.max(2, Math.round(raw * (0.9 + Math.random() * 0.2)));
      if (to.shield > 0 && now < to.shieldUntil) { const soak = Math.min(to.shield, dmg); to.shield -= soak; dmg -= soak; }
      to.hp = Math.max(0, to.hp - dmg);
      if (from.side === "ally" && to.side === "foe") {
        to.provoked = true;
        if (!to.target || to.target.dead) { to.target = from; to.angle = Math.atan2(to.y - from.y, to.x - from.x) + rnd(-0.8, 0.8); to.path = []; }
      }
      spawnFx(artOf(skill)?.hit, to.x, to.y, { ms: 480 });
      to.look.act = "hurt"; to.look.n++;
      from.look.act = "attack"; from.look.n++;
      spawnText(to.x, to.y, dmg > 0 ? String(dmg) : "Blocked", from.side === "ally" ? "text-gold" : "text-ember");
      if (to.hp <= 0) {
        to.dead = true; to.path = []; to.deadAt = now;
        if (to.side === "foe") {
          killReport(to);
          const pr = progress.current;
          if (to.boss) pr.boss = true; else pr.kills++;
          // The floor refills slowly: a kill buys a quiet spell before the next arrival.
          const plan = spawnPlan(baseMobCount(floor.n), players);
          pr.next = Math.max(pr.next, now + rnd(plan.afterKillMs[0], plan.afterKillMs[1]));
        }
      }
    };

    /**
     * A fighter's equipped skills. Each one fires on its own when it is off cooldown, there is energy for it and the moment
     * is right: heals when someone is hurt, shields when a fight is on, attacks and debuffs when a foe is in reach.
     */
    const cast = (a: Ag, now: number, A: Ag[], F: Ag[]) => {
      if (now < a.gcd) return;
      const friends = A.filter((u) => !u.dead && dist(a, u) < 10);
      const foesNear = F.filter((f) => !f.dead && dist(a, f) < 8);
      const fighting = foesNear.some((f) => f.target || f.provoked) || !!a.target;
      const hurtRatio = (u: Ag) => u.hp / u.max;
      for (const sk of a.skills) {
        if (now < sk.ready || a.en < sk.cost) continue;
        let done = false;
        const art = artOf(sk.name);
        const say = (text: string, cls: string) => spawnText(a.x, a.y - 0.4, text, cls, 1100, "dmg");
        if (sk.kind === "heal") {
          const wounded = friends.filter((u) => hurtRatio(u) < (sk.all ? 0.8 : 0.65)).sort((p, q) => hurtRatio(p) - hurtRatio(q));
          if (!wounded.length) continue;
          const targets = sk.all ? wounded : [wounded[0]];
          for (const u of targets) {
            const amt = Math.max(1, Math.round(Math.max(a.magic * sk.power * 0.5, u.max * 0.15 * sk.power) * (sk.all ? 0.8 : 1)));
            u.hp = Math.min(u.max, u.hp + amt);
            spawnFx(art?.hit ?? { sheet: "support", row: 0 }, u.x, u.y);
            spawnText(u.x, u.y, `+${amt}`, "text-leaf");
          }
          done = true;
        } else if (sk.kind === "shield") {
          if (!fighting) continue;
          const pool = sk.all ? friends : [sk.weakest ? [...friends].sort((p, q) => hurtRatio(p) - hurtRatio(q))[0] : a];
          for (const u of pool) {
            u.shield = Math.max(u.shield, Math.max(5, Math.round(Math.max(a.def * sk.power * 0.5, u.max * 0.12 * sk.power))));
            u.shieldUntil = now + 6000;
            spawnFx(art?.hit ?? { sheet: "support", row: 1 }, u.x, u.y);
            spawnText(u.x, u.y, "Shield", "text-steel");
          }
          done = true;
        } else if (sk.kind === "damage") {
          const t = a.target;
          if (!t || t.dead || dist(a, t) > 1.7 / ZOOM) continue;
          const hit = sk.area ? F.filter((f) => !f.dead && Math.hypot(f.x - t.x, f.y - t.y) < 3) : [t];
          if (art?.shot) spawnFx(art.shot, a.x, a.y, { to: [t.x, t.y], ms: 260, loop: true });
          hit.forEach((f) => hurt(a, f, now, sk.power, sk.type === "magical", sk.name));
          a.cd = Math.max(a.cd, 0.7);
          done = true;
        } else if (sk.kind === "buff") {
          if (!fighting) continue;
          if (/dodge|vanish|step/i.test(sk.name)) a.dodge = /vanish/i.test(sk.name) ? 2 : 1;
          else { friends.forEach((u) => { u.buffUntil = now + 8000; }); if (!art?.cast) friends.forEach((u) => spawnFx(art?.hit ?? { sheet: "support", row: 2 }, u.x, u.y)); }
          done = true;
        } else if (sk.kind === "debuff") {
          const t = a.target;
          if (!t || t.dead || dist(a, t) > 5) continue;
          const victims = sk.all ? foesNear : [t];
          victims.forEach((f) => { spawnFx(art?.hit ?? { sheet: "support", row: 3 }, f.x, f.y); f.weakUntil = now + 8000; if (/taunt/i.test(sk.name)) { f.target = a; f.path = []; } });
          done = true;
        }
        if (!done) continue;
        a.en -= sk.cost;
        sk.ready = now + sk.cd;
        a.gcd = now + 700;
        a.look.act = "attack"; a.look.n++;
        spawnFx(art?.cast, a.x, a.y, { ms: 640 });
        say(sk.name, sk.kind === "heal" ? "text-leaf" : sk.kind === "damage" ? "text-gold" : "text-steel");
        return;
      }
    };

    /** A new mob walks in from a patch of open ground, out of sight of the party when it can. */
    const trySpawn = (now: number, A: Ag[], F: Ag[]) => {
      if (!floor.zones.length) return false;
      for (let n = 0; n < 14; n++) {
        const z = floor.zones[Math.floor(Math.random() * floor.zones.length)];
        const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.max(0.6, z[2] - 1);
        const x = z[0] + Math.cos(ang) * d, y = z[1] + Math.sin(ang) * d * 0.7;
        if (!walkable(nav, x, y)) continue;
        const away = n < 9 ? 10 : 6;
        if (A.some((a) => !a.dead && dist(a, { x, y }) < away)) continue;
        if (F.some((f) => !f.dead && Math.hypot(f.x - x, f.y - y) < 1.6)) continue;
        const m = rollMob(floor.n, Math.random);
        foes.current.push(makeAg("foe", {
          id: `s${spawnId++}`, sprite: m.sprite, name: m.kind, level: m.level, x, y, hp: m.hp, atk: m.atk, def: m.def, kind: m.kind,
          home: [z[0], z[1], z[2]], wanderAt: now + rnd(1000, 3000), speedMul: rnd(0.9, 1.1), born: now, cd: 1,
        }));
        rerender();
        return true;
      }
      return false;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const A = allies.current, F = foes.current;
      const live = stateRef.current === "play";
      const aliveA = A.filter((a) => !a.dead), aliveF = F.filter((f) => !f.dead);
      const pr = progress.current;

      if (live) {
        const lead = aliveA[0];
        // The party's heading follows where it is going, smoothly, so the formation turns instead of snapping.
        const mover = lead && lead.path.length ? lead : aliveA.find((a) => a.path.length);
        if (mover) {
          const q = mover.path[0];
          pr.heading += angleDiff(Math.atan2(q[1] - mover.y, q[0] - mover.x), pr.heading) * Math.min(1, dt * 3);
        }

        const rule = RULES[stanceRef.current];
        const hold = stanceRef.current === "defensive";
        const spot = pr.anchor; // the ground Defend holds: where the party stood, or where it was last sent

        aliveA.forEach((a, i) => {
          a.cd = Math.max(0, a.cd - dt);
          a.repath -= dt;
          a.en = Math.min(a.maxEn, a.en + a.regen * dt);
          const spd = SPEED * a.speedMul;
          if (a.held) {
            if (a.delay > 0) { a.delay -= dt; return; } // each one sets off a beat apart
            if (!step(a, dt, spd)) a.held = false;
            return;
          }
          if (a.target && a.target.dead) a.target = null;
          if (!a.target) {
            // How far each fighter looks, and whether it may wander off the held ground, depends on the stance.
            let best = rule.aggro;
            for (const f of aliveF) {
              if (f.id === a.skipId && now < a.skipUntil) continue;
              const d = dist(a, f);
              if (d >= best) continue;
              if (hold && Math.hypot(f.x - spot[0], f.y - spot[1]) > rule.leash) continue;
              best = d; a.target = f;
            }
            // Each fighter takes its own side of the foe instead of piling onto one point.
            if (a.target) a.angle = Math.atan2(a.y - a.target.y, a.x - a.target.x) + (i === 0 ? 0 : i % 2 ? 0.9 : -0.9);
          }
          if (a.skills.length) cast(a, now, A, F);
          if (a.target) {
            const t = a.target, d = dist(a, t);
            if (d > 1.35) {
              if (a.repath <= 0 || !a.path.length) {
                a.path = findPath(nav, [a.x, a.y], ringPoint(t, a.angle, 1.0));
                a.repath = d > 14 ? 1.4 : 0.6; // long routes are worked out less often
                if (!a.path.length) { a.skipId = t.id; a.skipUntil = now + 4000; a.target = null; return; } // no way through: try another
              }
              step(a, dt, spd * rule.charge);
            } else {
              a.path = [];
              a.look.flip = t.x < a.x;
              if (a.cd <= 0) { a.cd = 0.9 * rnd(0.92, 1.15); hurt(a, t, now); }
            }
          } else if (hold || a !== lead) {
            // Nothing to fight: keep a loose formation around the leader (or around the held ground). Each fighter
            // eases toward its slot and drifts a little, slowly and smoothly, instead of twitching.
            const ref: Pt = hold ? spot : [lead.x, lead.y];
            const off = formationOffset(i, aliveA.length, pr.heading);
            const w = sway(a.slot * 2.1 + a.speedMul * 6, now);
            const want: Pt = [ref[0] + off[0] + w[0], ref[1] + off[1] + w[1]];
            const d = Math.hypot(want[0] - a.x, want[1] - a.y);
            if (d > (a.path.length ? STOP_MOVING : START_MOVING)) {
              if (a.repath <= 0 || !a.path.length) {
                const me: Pt = [a.x, a.y];
                a.path = d < 1.5 && walkable(nav, want[0], want[1]) && clearLine(nav, me, want) ? [want] : findPath(nav, me, want);
                a.repath = 0.5;
              }
              step(a, dt, spd * arriveEase(d));
            } else a.path = [];
          } else if (stanceRef.current === "neutral") {
            // The leader strolls a few tiles toward the mobs, rests, then strolls again; the others flow along behind.
            if (a.path.length) { pr.strolling = true; step(a, dt, spd * STROLL_SPEED); }
            else if (pr.strolling) { pr.strolling = false; pr.strollAt = now + rnd(4500, 9000); }
            else if (pr.strollAt < 0) pr.strollAt = now + 2500;
            else if (now >= pr.strollAt) {
              a.path = findPath(nav, [a.x, a.y], strollGoal(nav, [a.x, a.y], floor.zones));
              if (!a.path.length) pr.strollAt = now + 3000;
            }
          }
        });

        for (const f of aliveF) {
          f.cd = Math.max(0, f.cd - dt);
          f.repath -= dt;
          if (now - f.born < 900) continue; // just arrived
          if (f.target && (f.target.dead || Math.hypot(f.x - f.home[0], f.y - f.home[1]) > chaseRange(floor.n, f.boss) || dist(f, f.target) > loseRange(floor.n, f.boss))) {
            f.target = null; f.provoked = false; f.path = []; f.wanderAt = now + 600; // gives up and heads back home
          }
          if (!f.target) {
            let best = aggroRange(floor.n, f.kind, f.boss);
            for (const a of aliveA) { const d = dist(f, a); if (d < best) { best = d; f.target = a; } }
            if (f.target) { f.angle = Math.atan2(f.y - f.target.y, f.x - f.target.x) + rnd(-0.8, 0.8); f.path = []; }
          }
          if (!f.target) {
            // Nobody near: amble about its patch, rest a while, amble again.
            const w = WANDER[f.kind] ?? WANDER.slime;
            if (f.path.length) step(f, dt, w.speed * f.speedMul);
            else if (f.wanderAt === Infinity) f.wanderAt = now + rnd(w.rest[0], w.rest[1]) * 1000;
            else if (now >= f.wanderAt) {
              const rad = f.home[2] * 0.85, ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * rad;
              const to = nearestWalkable(nav, f.home[0] + Math.cos(ang) * d, f.home[1] + Math.sin(ang) * d * 0.7);
              f.path = findPath(nav, [f.x, f.y], to);
              f.wanderAt = f.path.length ? Infinity : now + 2000;
            }
            continue;
          }
          const t = f.target;
          if (dist(f, t) > 1.3 / ZOOM) {
            if (f.repath <= 0 || !f.path.length) { f.path = findPath(nav, [f.x, f.y], ringPoint(t, f.angle, 0.95)); f.repath = 0.6; }
            step(f, dt, MOB_SPEED * f.speedMul);
          } else {
            f.path = [];
            f.look.flip = t.x < f.x;
            if (f.cd <= 0) { f.cd = 1.3; hurt(f, t, now); }
          }
        }

        // Keep bodies apart so nobody stands inside anybody else.
        separate([...aliveA, ...aliveF].filter((u) => !u.dead), nav);

        // New arrivals, one at a time and never in a rush.
        const plan = spawnPlan(baseMobCount(floor.n), players);
        if (F.filter((f) => !f.dead && !f.boss).length < plan.cap && now >= pr.next) {
          pr.next = trySpawn(now, A, F) ? now + rnd(plan.gapMs[0], plan.gapMs[1]) : now + 2000;
        }
        // The fallen fade, then are cleared away.
        if (F.some((f) => f.dead && now - f.deadAt > 2500)) {
          foes.current = F.filter((f) => !(f.dead && now - f.deadAt > 2500));
          rerender();
        }

        if (!A.some((a) => !a.dead)) setState("lost");
        else {
          const gateAt = pr.gate === "next" ? { x: floor.exit[0], y: floor.exit[1] + 0.9 } : { x: floor.start[0], y: floor.start[1] + 0.9 };
          if (pr.gate && dist(A.find((x) => !x.dead)!, gateAt) < 2.3) {
            if (pr.gate === "back") setAskBack(true); else setAskNext(true);
            pr.gate = false;
          }
        }
      }

      // Draw.
      for (const u of [...A, ...F]) {
        if (!u.el) continue;
        u.el.style.transform = `translate(${u.x * T}px, ${u.y * T}px)`;
        u.el.style.zIndex = String(depth(u.y));
        const op = u.dead ? "0" : String(Math.min(1, (now - u.born) / 800)); // new arrivals fade in
        u.el.style.opacity = op;
        u.el.style.transition = u.dead ? "opacity .6s" : "";
        if (u.fx) {
          u.fx.style.transform = u.el.style.transform;
          u.fx.style.opacity = op;
          u.fx.style.transition = u.el.style.transition;
        }
        if (u.hpEl) u.hpEl.style.width = `${(u.hp / u.max) * 100}%`;
        if (u.path.length > 0 && !u.dead) u.movedAt = now;
        const moving = !u.dead && now - u.movedAt < 220; // short pauses between hops don't flicker to idle
        const rest = u.dead ? "stun" : moving ? "walk" : "idle";
        const l = u.look;
        if (l.rest !== rest) l.rest = rest;
        const key = `${l.rest}${l.flip}${l.n}`;
        if (u.key !== key) { u.key = key; u.setLook?.({ ...l }); }
      }

      // Camera.
      const c = cam.current, vw = c.vw, vh = c.vh;
      const WW = floor.w * T, HH = floor.h * T;
      const live2 = A.filter((a) => !a.dead);
      const cx = live2.length ? live2.reduce((s, a) => s + a.x, 0) / live2.length * T : WW / 2;
      const cy = live2.length ? live2.reduce((s, a) => s + a.y, 0) / live2.length * T : HH / 2;
      if (!c.free) {
        c.x += (cx - vw / 2 - c.x) * Math.min(1, dt * 5);
        c.y += (cy - vh / 2 - c.y) * Math.min(1, dt * 5);
      } else if (c.px >= 0) {
        const sp = 620 * dt;
        if (c.px < EDGE) c.x -= sp; else if (c.px > vw - EDGE) c.x += sp;
        if (c.py < EDGE) c.y -= sp; else if (c.py > vh - EDGE) c.y += sp;
      }
      c.x = WW <= vw ? (WW - vw) / 2 : Math.min(WW - vw, Math.max(0, c.x));
      c.y = HH <= vh ? (HH - vh) / 2 : Math.min(HH - vh, Math.max(0, c.y));
      if (world.current) world.current.style.transform = `translate(${-c.x}px, ${-c.y}px)`;

      // Arrow toward the party when it is off screen.
      const ar = arrow.current;
      if (ar) {
        const sx = cx - c.x, sy = cy - c.y;
        const off = sx < 0 || sy < 0 || sx > vw || sy > vh;
        ar.style.display = c.free && off ? "block" : "none";
        if (off) {
          const ax = Math.min(vw - 34, Math.max(34, sx)), ay = Math.min(vh - 34, Math.max(34, sy));
          ar.style.transform = `translate(${ax - 24}px, ${ay - 24}px)`;
          (ar.firstElementChild as HTMLElement).style.transform = `rotate(${Math.atan2(sy - vh / 2, sx - vw / 2)}rad)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { cam.current.vw = el.clientWidth; cam.current.vh = el.clientHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pointer: edge scroll while the pointer is near a screen edge; a short tap sends the party.
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const local = (e: PointerEvent) => {
    const r = view.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e: PointerEvent) => {
    const p = local(e), c = cam.current;
    c.px = p.x; c.py = p.y;
    const nearEdge = p.x < EDGE || p.y < EDGE || p.x > c.vw - EDGE || p.y > c.vh - EDGE;
    if (nearEdge && (e.pointerType === "mouse" || down.current)) { if (!c.free) { c.free = true; setFree(true); } }
  };
  const onDown = (e: PointerEvent) => { onMove(e); down.current = { ...local(e), t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    const d = down.current, p = local(e), c = cam.current;
    down.current = null;
    if (e.pointerType !== "mouse") c.px = -1;
    if (!d || stateRef.current !== "play") return;
    if (Math.hypot(p.x - d.x, p.y - d.y) > 10 || performance.now() - d.t > 500) return;
    if (p.x < EDGE || p.y < EDGE || p.x > c.vw - EDGE || p.y > c.vh - EDGE) return;
    const wx = (p.x + c.x) / T, wy = (p.y + c.y) / T;
    const foe = foes.current.find((f) => !f.dead && Math.hypot(f.x - wx, f.y - 0.6 / ZOOM - wy) < 0.9);
    const live = allies.current.filter((a) => !a.dead);
    progress.current.gate = false;
    // Tapping the white pillar walks the party into it; arriving there leads back out of the floor.
    const bx = floor.start[0], by = floor.start[1] + 0.9;
    // The gold pillar works the same way once its floor is open (Floors 2 and 3 need no unlock, so it is open from the start).
    const nx = floor.exit[0], ny = floor.exit[1] + 0.9;
    const onBack = Math.abs(wx - bx) < 0.9 && wy > by - 3.6 && wy < by + 0.5;
    const onNext = nextOpen && Math.abs(wx - nx) < 0.9 && wy > ny - 3.6 && wy < ny + 0.5;
    if (!foe && (onBack || onNext)) {
      const [gx, gy] = onNext ? [nx, ny] : [bx, by];
      progress.current.gate = onNext ? "next" : "back";
      const heading = Math.atan2(gy - (live[0]?.y ?? gy), gx - (live[0]?.x ?? gx));
      live.forEach((a, i) => {
        const to: Pt = nearestWalkable(nav, gx + formationOffset(i, live.length, heading)[0] * 0.5, gy + 0.9);
        a.path = findPath(nav, [a.x, a.y], to);
        a.held = a.path.length > 0; a.target = null; a.delay = i * 0.1;
      });
      return;
    }
    if (foe) {
      live.forEach((a, i) => {
        a.target = foe; a.held = false; a.path = [];
        a.angle = Math.atan2(a.y - foe.y, a.x - foe.x) + (i === 0 ? 0 : i % 2 ? 0.9 : -0.9);
      });
      return;
    }
    const goal = nearestWalkable(nav, wx, wy);
    // The party arrives as a group facing the way it travelled, not all on the tapped point.
    const heading = live.length ? Math.atan2(goal[1] - live[0].y, goal[0] - live[0].x) : 0;
    progress.current.heading = heading;
    progress.current.anchor = goal; // Defend holds wherever the party was last sent
    progress.current.strolling = false;
    live.forEach((a, i) => {
      const off = formationOffset(i, live.length, heading);
      const to: Pt = nearestWalkable(nav, goal[0] + off[0], goal[1] + off[1]);
      a.path = findPath(nav, [a.x, a.y], to);
      a.held = a.path.length > 0; a.target = null;
      a.delay = i === 0 ? 0 : rnd(0.05, 0.35);
    });
    const m = marker.current;
    if (m) { m.style.left = `${goal[0] * T}px`; m.style.top = `${goal[1] * T}px`; m.classList.remove("marker-ping"); void m.offsetWidth; m.classList.add("marker-ping"); }
  };
  const recenter = () => { cam.current.free = false; setFree(false); };

  const pickStance = (s: Stance) => {
    stanceRef.current = s;
    setStanceState(s);
    const pr = progress.current, lead = allies.current.find((a) => !a.dead);
    if (lead) pr.anchor = [lead.x, lead.y]; // Defend holds where the party is standing right now
    pr.strolling = false; pr.strollAt = -1; // the loop schedules the next stroll
    // Everyone looks again under the new rules, so the buttons feel immediate.
    allies.current.forEach((a) => { if (!a.held) { a.target = null; a.path = []; } });
  };

  const A = floor.theme.atlas;
  const quest = tutorialStep === 8 && floor.n === 1;
  // Floors 1 to 3 open one by one as you clear them; from Floor 3 on, the job-board quests open the next floor.
  const nextOpen = floor.n < MAX_FLOOR && (floor.n < 3 ? !isBossFloor(floor.n) : floor.n + 1 <= floorUnlocked);

  return (
    <div className="relative flex h-dvh w-full flex-col bg-ink">
      {state === "play" && <Music track={floorTrack(floor.n, isBossFloor(floor.n))} />}
      <div className="z-[9500] flex items-center gap-3 bg-night/90 px-3 py-2 text-paper">
        <Link href="/home" className="pixel-box bg-panel px-3 py-1 text-lg uppercase">← Guild</Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-lg uppercase text-gold">Floor {floor.n}{isBossFloor(floor.n) && " · Boss"}</p>
          <p className="truncate text-sm text-steel">{floor.theme.name}</p>
        </div>
      </div>
      {quest && !firstJobDone && state === "play" && <p className="z-[9400] bg-gold/90 px-3 py-1 text-center text-base text-ink">First job: defeat a bat on this floor.</p>}

      <div
        ref={view}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") cam.current.px = -1; }}
      >
        <div ref={world} className="absolute left-0 top-0 will-change-transform" style={{ width: floor.w * T, height: floor.h * T }}>
          <canvas ref={ground} width={floor.w * T} height={floor.h * T} className="absolute inset-0" />
          {floor.props.map((p) => {
            // The two gates are pillars of light: white leads back, green leads on (dim until the floor is clear).
            if (p.kind === "entry" || p.kind === "exit") {
              const label = p.kind === "entry" ? (floor.n > 1 ? `Floor ${floor.n - 1}` : "Guild") : floor.n >= MAX_FLOOR ? "Summit" : `Floor ${floor.n + 1}`;
              const off = p.kind === "exit" && !nextOpen;
              return (
                <div key={p.id}>
                  <div className={`pillar ${p.kind === "entry" ? "pillar-back" : nextOpen ? "pillar-next" : "pillar-next pillar-off"}`} style={{ left: p.x * T, top: p.y * T, zIndex: depth(p.y) }} />
                  <span
                    className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-xl font-bold leading-none ${p.kind === "entry" ? "text-paper" : "text-gold"} ${off ? "opacity-50" : ""}`}
                    style={{ left: p.x * T, top: p.y * T - 238, zIndex: 9000, textShadow: "0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}
                  >{label}</span>
                </div>
              );
            }
            const r = A.rects[p.idx];
            const k = (p.w * T) / ((r.w * (p.crop ?? 1)));
            return (
              <div
                key={p.id}
                className="pointer-events-none absolute"
                style={{
                  left: p.x * T - (p.w * T) / 2, top: p.y * T - r.h * k,
                  width: r.w * (p.crop ?? 1) * k, height: r.h * k,
                  backgroundImage: `url(${A.url})`, backgroundSize: `${A.w * k}px ${A.h * k}px`,
                  backgroundPosition: `${-r.x * k}px ${-r.y * k}px`, imageRendering: "auto",
                  zIndex: p.kind === "decor" ? 4 : depth(p.y),
                }}
              />
            );
          })}
          <div ref={marker} className="marker pointer-events-none absolute z-[5] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold opacity-0" />
          {ready && [...allies.current, ...foes.current].map((u) => <Unit key={u.id} a={u} party={partyLvl} />)}
        </div>

        {state === "play" && (
          <div
            role="group" aria-label="Party behaviour"
            className="absolute left-2 top-1/2 z-[9600] flex -translate-y-1/2 flex-col gap-2"
            onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
          >
            {STANCES.map((o) => (
              <button
                key={o.id} type="button" aria-pressed={stance === o.id} aria-label={o.label} onClick={() => pickStance(o.id)}
                className={`group relative flex h-12 w-12 items-center justify-center pixel-box ${stance === o.id ? "bg-gold" : "bg-night/90"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/ui/stance-${{ offensive: "attack", neutral: "balanced", defensive: "defend" }[o.id]}.png`} alt="" className="h-8 w-8 [image-rendering:pixelated]" draggable={false} />
                <span className="pointer-events-none absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap bg-night px-2 py-1 text-base uppercase text-paper group-hover:block group-focus-visible:block">
                  {o.label}
                  <span className="block text-sm normal-case opacity-80">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <button ref={arrow} type="button" onClick={recenter} aria-label="Back to your fighters" className="pixel-box absolute left-0 top-0 z-[9600] hidden h-12 w-12 bg-night/90" style={{ display: "none" }}>
          <span className="block text-2xl leading-[3rem] text-gold">➤</span>
        </button>
        {free && <button type="button" onClick={recenter} className="pixel-box absolute bottom-3 right-3 z-[9600] bg-night/90 px-3 py-1 text-lg uppercase text-paper">Follow party</button>}

        {toast && state === "play" && (
          <p key={toast.id} role="status" className="job-toast pointer-events-none absolute inset-x-0 top-3 z-[9600] mx-auto w-fit max-w-[90%] bg-night/95 px-4 py-2 text-center text-xl uppercase text-gold pixel-box">{toast.text}</p>
        )}

        {askNext && state === "play" && (
          <div className="absolute inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-4">
            <div className="pixel-box card-reveal w-full max-w-sm bg-night p-5 text-center">
              <h2 className="mb-2 text-3xl uppercase text-gold">Go to Floor {floor.n + 1}?</h2>
              <p className="mb-4 text-xl text-paper">Your party will take the golden light up.</p>
              <div className="flex flex-col gap-2">
                <PixelButton className="w-full" onClick={() => router.push(`/floor/${floor.n + 1}`)}>Go to Floor {floor.n + 1}</PixelButton>
                <PixelButton variant="ghost" className="w-full" onClick={() => setAskNext(false)}>Stay here</PixelButton>
              </div>
            </div>
          </div>
        )}

        {askBack && state === "play" && (
          <div className="absolute inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-4">
            <div className="pixel-box card-reveal w-full max-w-sm bg-night p-5 text-center">
              <h2 className="mb-2 text-3xl uppercase text-paper">{floor.n > 1 ? `Back to Floor ${floor.n - 1}?` : "Return to the guild?"}</h2>
              <p className="mb-4 text-xl text-paper">{floor.n > 1 ? "Your party will take the white light back down." : "This ends the expedition."}</p>
              <div className="flex flex-col gap-2">
                <PixelButton className="w-full" onClick={() => router.push(floor.n > 1 ? `/floor/${floor.n - 1}?from=above` : "/home")}>{floor.n > 1 ? `Go to Floor ${floor.n - 1}` : "Return"}</PixelButton>
                <PixelButton variant="ghost" className="w-full" onClick={() => setAskBack(false)}>Stay here</PixelButton>
              </div>
            </div>
          </div>
        )}

        {state !== "play" && (
          <div className="absolute inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-4">
            <div className="pixel-box card-reveal w-full max-w-sm bg-night p-5 text-center">
                <>
                  <h2 className="mb-2 text-3xl uppercase text-ember">Party down</h2>
                  <p className="mb-4 text-xl text-paper">Your fighters were beaten. Rest up and try again.</p>
                  <div className="flex flex-col gap-2">
                    <PixelButton className="w-full" onClick={retry}>Try again</PixelButton>
                    <Link href="/home"><PixelButton variant="ghost" className="w-full">Back to the guild</PixelButton></Link>
                  </div>
                </>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
