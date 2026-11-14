"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { findPath, buildNav, nearestWalkable, type Pt } from "@/lib/guild-nav";
import { createClient } from "@/lib/supabase/client";
import { MAX_FLOOR, TILE_SRC, generateFloor, isBossFloor, type Floor } from "@/lib/world/floor";

const T = 48; // one tile on screen, in px
const FRAME = 2.7; // a sprite frame, in tiles
const EDGE = 44; // px from the screen edge where the camera starts to scroll
const SPEED = 3.1;
const MOB_SPEED = 2.3;
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
  setLook?: (l: Ag["look"]) => void;
  el?: HTMLDivElement | null;
  bar?: HTMLDivElement | null;
  hpEl?: HTMLDivElement | null;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function Unit({ a }: { a: Ag }) {
  const [look, setLook] = useState(a.look);
  const size = FRAME * T * (a.boss ? 1.5 : 1);
  return (
    <div
      ref={(el) => { a.el = el; a.setLook = setLook; }}
      className="absolute left-0 top-0 will-change-transform"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size * 0.86 }}
    >
      <div className="absolute left-1/4 top-0 h-1.5 w-1/2 -translate-y-1 bg-ink/80" ref={(el) => { a.bar = el; }}>
        <div ref={(el) => { a.hpEl = el; }} className={a.side === "ally" ? "h-full w-full bg-leaf" : "h-full w-full bg-ember"} />
      </div>
      <FighterSprite
        spriteKey={a.sprite} role={a.role} flip={look.flip} rest={look.rest}
        action={look.act} actionKey={look.n}
      />
    </div>
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
export function FloorScreen({ floorNo, fighters, tutorialStep }: { floorNo: number; fighters: GuildFighter[]; tutorialStep: number }) {
  const floor = useMemo(() => generateFloor(floorNo), [floorNo]);
  const [run, setRun] = useState(0); // bump to retry
  return <FloorMap key={run} floor={floor} fighters={fighters} tutorialStep={tutorialStep} retry={() => setRun((r) => r + 1)} />;
}

function FloorMap({ floor, fighters, tutorialStep, retry }: { floor: Floor; fighters: GuildFighter[]; tutorialStep: number; retry: () => void }) {
  const nav = useMemo(() => buildNav(floor.nav), [floor]);
  const squad = useMemo(() => {
    const team = fighters.filter((f) => f.team_slot != null).sort((a, b) => (a.team_slot ?? 0) - (b.team_slot ?? 0));
    return (team.length ? team : fighters).slice(0, 3);
  }, [fighters]);

  const allies = useRef<Ag[]>([]);
  const foes = useRef<Ag[]>([]);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"play" | "won" | "lost">("play");
  const [left, setLeft] = useState(floor.mobs.length);
  const [free, setFree] = useState(false); // camera detached from the party

  const view = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const ground = useRef<HTMLCanvasElement>(null);
  const cam = useRef({ x: 0, y: 0, free: false, px: -1, py: -1, vw: 800, vh: 600 });
  const marker = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Build the two sides once.
  useEffect(() => {
    const mk = (side: Ag["side"], p: Partial<Ag> & Pick<Ag, "id" | "sprite" | "name" | "level" | "x" | "y" | "hp" | "atk" | "def" | "kind">): Ag => ({
      role: "dps", max: p.hp, path: [], target: null, cd: 0, repath: 0, dead: false, boss: false, held: false,
      look: { rest: "idle", flip: false, act: null, n: 0 }, side, ...p,
    });
    allies.current = squad.map((f, i) =>
      mk("ally", {
        id: f.id, sprite: f.template.sprite_key, role: f.template.role, name: f.template.name, level: f.level,
        x: floor.start[0] + 1.6 + (i % 2) * 0.9, y: floor.start[1] + (i - 1) * 1.0, hp: f.hp, atk: f.atk, def: f.def, kind: "fighter",
      }),
    );
    foes.current = floor.mobs.map((m) =>
      mk("foe", { id: `m${m.id}`, sprite: m.sprite, name: m.kind, level: m.level, x: m.x, y: m.y, hp: m.hp, atk: m.atk, def: m.def, boss: m.boss, kind: m.kind }),
    );
    setReady(true);
  }, [floor, squad]);

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

  const spawnText = (x: number, y: number, text: string, cls: string) => {
    const d = document.createElement("div");
    d.textContent = text;
    d.className = `pointer-events-none absolute z-[9000] text-xl font-bold ${cls}`;
    d.style.cssText += `;left:${x * T}px;top:${(y - 1.6) * T}px;animation:dmg 700ms ease-out forwards`;
    world.current?.appendChild(d);
    setTimeout(() => d.remove(), 720);
  };

  const killReport = (m: Ag) => {
    const spec = floor.mobs[Number(m.id.slice(1))];
    void createClient().rpc("report_floor_kill", { p_floor: floor.n, p_kind: spec.kind, p_level: spec.level, p_boss: spec.boss });
  };

  // The loop: movement, fighting, camera.
  useEffect(() => {
    if (!ready) return;
    let raf = 0, last = performance.now();
    const step = (a: Ag, dt: number, speed: number) => {
      const p = a.path[0];
      if (!p) return false;
      const dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), m = speed * dt;
      if (Math.abs(dx) > 0.05) a.look.flip = dx < 0;
      if (d <= m) { a.x = p[0]; a.y = p[1]; a.path.shift(); } else { a.x += (dx / d) * m; a.y += (dy / d) * m; }
      return true;
    };
    const hurt = (from: Ag, to: Ag) => {
      const raw = from.side === "ally" ? from.atk - to.def * 0.5 : from.atk - to.def * 0.45;
      const dmg = Math.max(2, Math.round(raw * (0.9 + Math.random() * 0.2)));
      to.hp = Math.max(0, to.hp - dmg);
      to.look.act = "hurt"; to.look.n++;
      from.look.act = "attack"; from.look.n++;
      spawnText(to.x, to.y, String(dmg), from.side === "ally" ? "text-gold" : "text-ember");
      if (to.hp <= 0) {
        to.dead = true; to.path = [];
        if (to.side === "foe") {
          killReport(to);
          setLeft(foes.current.filter((f) => !f.dead).length);
        }
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const A = allies.current, F = foes.current;
      const live = stateRef.current === "play";
      const aliveA = A.filter((a) => !a.dead), aliveF = F.filter((f) => !f.dead);

      if (live) {
        for (const a of aliveA) {
          a.cd = Math.max(0, a.cd - dt);
          a.repath -= dt;
          if (a.held) {
            if (!step(a, dt, SPEED)) a.held = false;
            continue;
          }
          if (!a.target || a.target.dead) {
            a.target = null;
            let best = 7;
            for (const f of aliveF) { const d = dist(a, f); if (d < best) { best = d; a.target = f; } }
          }
          if (a.target) {
            const d = dist(a, a.target);
            if (d > 1.2) {
              if (a.repath <= 0 || !a.path.length) { a.path = findPath(nav, [a.x, a.y], [a.target.x, a.target.y]); a.repath = 0.6; }
              step(a, dt, SPEED);
            } else {
              a.path = [];
              a.look.flip = a.target.x < a.x;
              if (a.cd <= 0) { a.cd = 0.9; hurt(a, a.target); }
            }
          } else {
            // No foe near: stay with the group.
            const lead = aliveA[0];
            if (lead !== a && dist(a, lead) > 2.4) {
              if (a.repath <= 0 || !a.path.length) { a.path = findPath(nav, [a.x, a.y], [lead.x, lead.y]); a.repath = 0.8; }
              step(a, dt, SPEED);
            }
          }
        }
        for (const f of aliveF) {
          f.cd = Math.max(0, f.cd - dt);
          f.repath -= dt;
          if (!f.target || f.target.dead) {
            f.target = null;
            let best = f.boss ? 7 : 4.6;
            for (const a of aliveA) { const d = dist(f, a); if (d < best) { best = d; f.target = a; } }
          }
          if (!f.target) continue;
          if (dist(f, f.target) > 1.15) {
            if (f.repath <= 0 || !f.path.length) { f.path = findPath(nav, [f.x, f.y], [f.target.x, f.target.y]); f.repath = 0.6; }
            step(f, dt, MOB_SPEED);
          } else {
            f.path = [];
            f.look.flip = f.target.x < f.x;
            if (f.cd <= 0) { f.cd = 1.3; hurt(f, f.target); }
          }
        }
        if (!A.some((a) => !a.dead)) setState("lost");
        else if (F.every((f) => f.dead)) {
          const lead = A.find((a) => !a.dead)!;
          if (dist(lead, { x: floor.exit[0] + (isBossFloor(floor.n) ? 2.6 : 0), y: floor.exit[1] + 0.9 }) < 2.4) {
            setState("won");
            void createClient().rpc("clear_floor", { p_floor: floor.n });
          }
        }
      }

      // Draw.
      for (const u of [...A, ...F]) {
        if (!u.el) continue;
        u.el.style.transform = `translate(${u.x * T}px, ${u.y * T}px)`;
        u.el.style.zIndex = String(depth(u.y));
        u.el.style.opacity = u.dead ? "0" : "1";
        u.el.style.transition = u.dead ? "opacity .6s" : "";
        if (u.hpEl) u.hpEl.style.width = `${(u.hp / u.max) * 100}%`;
        const moving = u.path.length > 0 && !u.dead;
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
    const foe = foes.current.find((f) => !f.dead && Math.hypot(f.x - wx, f.y - 0.6 - wy) < 0.9);
    const live = allies.current.filter((a) => !a.dead);
    if (foe) { for (const a of live) { a.target = foe; a.held = false; a.path = []; } return; }
    const goal = nearestWalkable(nav, wx, wy);
    live.forEach((a, i) => {
      const to: Pt = nearestWalkable(nav, goal[0] + (i % 2 ? 0.8 : -0.8), goal[1] + (i - 1) * 0.5);
      a.path = findPath(nav, [a.x, a.y], to);
      a.held = a.path.length > 0; a.target = null;
    });
    const m = marker.current;
    if (m) { m.style.left = `${goal[0] * T}px`; m.style.top = `${goal[1] * T}px`; m.classList.remove("marker-ping"); void m.offsetWidth; m.classList.add("marker-ping"); }
  };
  const recenter = () => { cam.current.free = false; setFree(false); };

  const A = floor.theme.atlas;
  const boss = isBossFloor(floor.n);
  const quest = tutorialStep === 8 && floor.n === 1;
  const next = floor.n < MAX_FLOOR;
  const alive = left;

  return (
    <div className="relative flex h-dvh w-full flex-col bg-ink">
      <div className="z-[9500] flex items-center gap-3 bg-night/90 px-3 py-2 text-paper">
        <Link href="/home" className="pixel-box bg-panel px-3 py-1 text-lg uppercase">← Guild</Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-lg uppercase text-gold">Floor {floor.n}{boss && " · Boss"}</p>
          <p className="truncate text-sm text-steel">{floor.theme.name}</p>
        </div>
        <p className="text-lg">Foes <span className="text-ember">{alive}</span>/{floor.mobs.length}</p>
      </div>
      {quest && state === "play" && <p className="z-[9400] bg-gold/90 px-3 py-1 text-center text-base text-ink">First job: defeat a bat on this floor.</p>}

      <div
        ref={view}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") cam.current.px = -1; }}
      >
        <div ref={world} className="absolute left-0 top-0 will-change-transform" style={{ width: floor.w * T, height: floor.h * T }}>
          <canvas ref={ground} width={floor.w * T} height={floor.h * T} className="absolute inset-0" />
          {floor.props.map((p) => {
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
                  filter: p.kind === "exit" && alive > 0 ? "grayscale(.85) brightness(.7)" : undefined,
                }}
              />
            );
          })}
          <div ref={marker} className="marker pointer-events-none absolute z-[5] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold opacity-0" />
          {ready && [...allies.current, ...foes.current].map((u) => <Unit key={u.id} a={u} />)}
        </div>

        <button ref={arrow} type="button" onClick={recenter} aria-label="Back to your fighters" className="pixel-box absolute left-0 top-0 z-[9600] hidden h-12 w-12 bg-night/90" style={{ display: "none" }}>
          <span className="block text-2xl leading-[3rem] text-gold">➤</span>
        </button>
        {free && <button type="button" onClick={recenter} className="pixel-box absolute bottom-3 right-3 z-[9600] bg-night/90 px-3 py-1 text-lg uppercase text-paper">Follow party</button>}

        {state === "play" && alive === 0 && <p className="pointer-events-none absolute inset-x-0 top-3 z-[9600] text-center text-2xl uppercase text-gold drop-shadow">Floor clear! Head for the portal.</p>}

        {state !== "play" && (
          <div className="absolute inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-4">
            <div className="pixel-box card-reveal w-full max-w-sm bg-night p-5 text-center">
              {state === "won" ? (
                <>
                  <h2 className="mb-2 text-3xl uppercase text-gold">Floor {floor.n} cleared</h2>
                  <p className="mb-4 text-xl text-paper">{floor.n >= MAX_FLOOR ? "You reached the top of the tower." : boss ? "The boss is down. A new region opens." : "The portal leads deeper."}</p>
                  <div className="flex flex-col gap-2">
                    {next && <Link href={`/floor/${floor.n + 1}`}><PixelButton className="w-full">Floor {floor.n + 1}</PixelButton></Link>}
                    <Link href="/home"><PixelButton variant="ghost" className="w-full">Back to the guild</PixelButton></Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-3xl uppercase text-ember">Party down</h2>
                  <p className="mb-4 text-xl text-paper">Your fighters were beaten. Rest up and try again.</p>
                  <div className="flex flex-col gap-2">
                    <PixelButton className="w-full" onClick={retry}>Try again</PixelButton>
                    <Link href="/home"><PixelButton variant="ghost" className="w-full">Back to the guild</PixelButton></Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
