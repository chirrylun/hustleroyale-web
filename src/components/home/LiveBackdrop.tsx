"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FighterSprite, type Action } from "@/components/sprites/FighterSprite";
import { buildNav, findPath, nearestWalkable, type Pt } from "@/lib/guild-nav";
import { TILE_SRC, generateFloor, rollMob, type Floor } from "@/lib/world/floor";
import { mobScale, type Role } from "@/lib/sprites/designs";

/*
 * The front page's moving backdrop: a made-up floor where visiting heroes wander in, fight whatever lives there, and
 * leave, while the camera drifts across the map. It is all for show (no server, no sign-in), drawn under a dark veil.
 */
const T = 34, FRAME = 2.7;
const HEROES: [string, Role][] = [
  ["paladin_common", "tank"], ["paladin_rare", "tank"], ["tank_uncommon", "tank"], ["healer_rare", "healer"], ["bard_uncommon", "healer"],
  ["marksman_common", "dps"], ["marksman_rare", "dps"], ["rogue_uncommon", "dps"], ["magical_dps_rare", "dps"], ["necromancer_common", "dps"],
  ["novice_male", "dps"], ["novice_female", "dps"], ["dps_rare", "dps"],
];
const NAMES = ["Aldric", "Mira", "Kael", "Sera", "Thorn", "Lyra", "Bram", "Isolde", "Finn", "Rowan", "Elara", "Garrick", "Nyx", "Dorian", "Wren", "Cassian"];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

interface E {
  id: number; hero: boolean; sprite: string; role: Role; name: string; level: number; boss: boolean;
  x: number; y: number; hp: number; max: number; atk: number; size: number;
  flip: boolean; act: Action | null; n: number; born: number;
  path: Pt[]; target: E | null; nextHit: number; repath: number; kills: number; leaveAt: number; leaving: boolean; dead: boolean; deadAt: number;
  home: Pt; wanderAt: number; key: string;
  el: HTMLDivElement | null; hpEl: HTMLDivElement | null; setLook?: (l: { rest: "idle" | "walk"; flip: boolean; act: Action | null; n: number }) => void;
}

let uid = 1;
const mk = (p: Partial<E> & Pick<E, "hero" | "sprite" | "role" | "name" | "level" | "x" | "y" | "hp" | "atk">, now: number): E => ({
  id: uid++, boss: false, max: p.hp, size: FRAME * T * (p.hero ? 1 : mobScale(p.sprite)), flip: false, act: null, n: 0, born: now,
  path: [], target: null, nextHit: 0, repath: 0, kills: 0, leaveAt: 0, leaving: false, dead: false, deadAt: 0, home: [p.x, p.y], wanderAt: now + rnd(0, 3000), key: "",
  el: null, hpEl: null, ...p,
});

function Ent({ e }: { e: E }) {
  const [look, setLook] = useState({ rest: "idle" as "idle" | "walk", flip: e.flip, act: e.act, n: e.n });
  return (
    <div ref={(el) => { e.el = el; e.setLook = setLook; }} className="absolute left-0 top-0 will-change-transform" style={{ width: e.size, height: e.size, marginLeft: -e.size / 2, marginTop: -e.size * 0.86, opacity: 0 }}>
      <FighterSprite spriteKey={e.sprite} role={e.role} flip={look.flip} rest={look.rest} action={look.act} actionKey={look.n} />
      <div className="absolute left-1/2 top-0 h-1.5 w-[max(50%,26px)] -translate-x-1/2 -translate-y-1 bg-ink/80">
        <div ref={(el) => { e.hpEl = el; }} className={e.hero ? "h-full w-full bg-leaf" : "h-full w-full bg-ember"} />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-bold capitalize leading-none text-paper" style={{ textShadow: "0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}>
          {e.hero ? `${e.name} · Lv ${e.level}` : `Lv ${e.level} ${e.name}`}
        </span>
      </div>
    </div>
  );
}

function Stage({ floor }: { floor: Floor }) {
  const nav = useMemo(() => buildNav(floor.nav), [floor]);
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const ground = useRef<HTMLCanvasElement>(null);
  const ents = useRef<E[]>([]);
  const [, bump] = useState(0);
  const A = floor.theme.atlas;

  // Ground: the same tiles the real floors use.
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
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (cells[j * w + i] === kind) lg.drawImage(img, (variant[j * w + i] % mod) * TILE_SRC, row * TILE_SRC, TILE_SRC, TILE_SRC, i * T, j * T, T + 1, T + 1);
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

  useEffect(() => {
    const now0 = performance.now();
    ents.current = floor.mobs.filter((m) => !m.boss).map((m) => {
      const [x, y] = nearestWalkable(nav, m.x, m.y);
      return mk({ hero: false, sprite: m.sprite, role: "dps", name: m.kind, level: m.level, x, y, hp: m.hp, atk: m.atk }, now0 - 5000);
    });
    bump((v) => v + 1);

    const zones = floor.zones.length ? floor.zones : [[floor.w / 2, floor.h / 2, 4] as [number, number, number]];
    const cam = { x: zones[0][0], y: zones[0][1], tx: zones[0][0], ty: zones[0][1] };
    let nextHero = now0 + 1500, nextMob = now0 + 6000;
    let raf = 0, last = now0;

    const view = () => ({ w: box.current?.clientWidth ?? 1200, h: box.current?.clientHeight ?? 700 });
    const step = (e: E, dt: number, speed: number) => {
      const p = e.path[0];
      if (!p) return;
      const dx = p[0] - e.x, dy = p[1] - e.y, d = Math.hypot(dx, dy);
      if (d < 0.08) { e.path.shift(); return; }
      const s = Math.min(d, speed * dt);
      e.x += (dx / d) * s; e.y += (dy / d) * s;
      if (Math.abs(dx) > 0.02) e.flip = dx < 0;
    };
    const goTo = (e: E, to: Pt) => { e.path = findPath(nav, [e.x, e.y], nearestWalkable(nav, to[0], to[1])); };

    const spawnHeroes = (now: number) => {
      const v = view();
      const group = Math.random() < 0.4 ? Math.floor(rnd(2, 4)) : 1;
      const cx = rnd(cam.x - v.w / T / 3, cam.x + v.w / T / 3), cy = rnd(cam.y - v.h / T / 3, cam.y + v.h / T / 3);
      const lvl = Math.max(1, Math.round(floor.n + rnd(-1, 3)));
      for (let i = 0; i < group; i++) {
        const [spr, role] = pick(HEROES);
        const [x, y] = nearestWalkable(nav, cx + rnd(-1.5, 1.5), cy + rnd(-1, 1));
        ents.current.push(mk({ hero: true, sprite: spr, role, name: pick(NAMES), level: lvl + Math.floor(rnd(0, 2)), x, y, hp: 100, atk: 14 + lvl * 2, leaveAt: now + rnd(16000, 32000) }, now + i * 250));
      }
      bump((n) => n + 1);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const E = ents.current;
      const heroes = E.filter((e) => e.hero), mobs = E.filter((e) => !e.hero && !e.dead);
      let changed = false;

      if (now > nextHero && heroes.filter((h) => !h.leaving).length < 5) { spawnHeroes(now); nextHero = now + rnd(3500, 8000); }
      if (now > nextMob && mobs.length < 12) {
        const z = pick(zones), a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * Math.max(0.6, z[2] - 1);
        const m = rollMob(floor.n, Math.random);
        const [x, y] = nearestWalkable(nav, z[0] + Math.cos(a) * d, z[1] + Math.sin(a) * d * 0.7);
        E.push(mk({ hero: false, sprite: m.sprite, role: "dps", name: m.kind, level: m.level, x, y, hp: m.hp, atk: m.atk, home: [x, y] }, now));
        nextMob = now + rnd(4000, 9000); changed = true;
      }

      for (const e of E) {
        if (e.dead) continue;
        if (e.hero) {
          if (!e.leaving && now > e.leaveAt) { e.leaving = true; e.target = null; const far = pick(zones); goTo(e, [far[0] + rnd(-6, 6), far[1] + rnd(-6, 6)]); e.leaveAt = now + 4500; }
          if (e.leaving) { step(e, dt, 3.4); if (now > e.leaveAt) { e.dead = true; e.deadAt = now - 1500; } continue; }
          if (!e.target || e.target.dead) {
            e.target = null;
            let best: E | null = null, bd = 16;
            for (const m of mobs) { const d = Math.hypot(m.x - e.x, m.y - e.y); if (!m.dead && d < bd) { bd = d; best = m; } }
            e.target = best; e.repath = 0;
            if (!best && e.path.length === 0 && now > e.wanderAt) { goTo(e, [e.x + rnd(-6, 6), e.y + rnd(-4, 4)]); e.wanderAt = now + rnd(2500, 5000); }
          }
          const t = e.target;
          if (t) {
            const d = Math.hypot(t.x - e.x, t.y - e.y);
            if (d > 1.5) { if (now > e.repath) { goTo(e, [t.x - Math.sign(t.x - e.x) * 1.1, t.y]); e.repath = now + 700; } step(e, dt, 3.2); }
            else {
              e.path = []; e.flip = t.x < e.x;
              if (now > e.nextHit) {
                e.nextHit = now + rnd(800, 1100);
                e.act = "attack"; e.n++;
                t.hp -= Math.round(e.atk * rnd(0.8, 1.2)); t.act = "hurt"; t.n++; t.target = e;
                if (t.hp <= 0) { t.dead = true; t.deadAt = now; e.kills++; e.target = null; if (e.kills >= 3) e.leaveAt = Math.min(e.leaveAt, now + 1500); }
              }
            }
          } else step(e, dt, 2.2);
        } else {
          const t = e.target && !e.target.dead && !e.target.leaving ? e.target : null;
          if (t && Math.hypot(t.x - e.x, t.y - e.y) < 2) {
            e.flip = t.x < e.x;
            if (now > e.nextHit) { e.nextHit = now + rnd(1100, 1600); e.act = "attack"; e.n++; t.act = "hurt"; t.n++; }
          } else {
            if (e.path.length === 0 && now > e.wanderAt) { goTo(e, [e.home[0] + rnd(-2.5, 2.5), e.home[1] + rnd(-2, 2)]); e.wanderAt = now + rnd(2500, 6000); }
            step(e, dt, 0.9);
          }
        }
      }
      if (E.some((e) => e.dead && now - e.deadAt > 2200)) { ents.current = E.filter((e) => !(e.dead && now - e.deadAt > 2200)); changed = true; }
      if (changed) bump((v) => v + 1);

      // Camera: drifts from one busy spot to the next.
      if (Math.hypot(cam.tx - cam.x, cam.ty - cam.y) < 0.6) {
        const live = ents.current.filter((e) => !e.dead && !e.leaving);
        const spot = live.length && Math.random() < 0.7 ? pick(live) : null;
        if (spot) { cam.tx = spot.x; cam.ty = spot.y; } else { const z = pick(zones); cam.tx = z[0]; cam.ty = z[1]; }
      }
      const cd = Math.hypot(cam.tx - cam.x, cam.ty - cam.y);
      if (cd > 0.01) { const s = Math.min(cd, 1.7 * dt); cam.x += ((cam.tx - cam.x) / cd) * s; cam.y += ((cam.ty - cam.y) / cd) * s; }
      const v = view();
      const cx = Math.max(Math.min(v.w / 2, floor.w * T - v.w / 2), Math.min(cam.x * T, Math.max(v.w / 2, floor.w * T - v.w / 2)));
      const cy = Math.max(Math.min(v.h / 2, floor.h * T - v.h / 2), Math.min(cam.y * T, Math.max(v.h / 2, floor.h * T - v.h / 2)));
      if (world.current) world.current.style.transform = `translate3d(${Math.round(v.w / 2 - cx)}px, ${Math.round(v.h / 2 - cy)}px, 0)`;

      for (const e of ents.current) {
        if (!e.el) continue;
        e.el.style.transform = `translate(${e.x * T}px, ${e.y * T}px)`;
        e.el.style.zIndex = String(10 + Math.round(e.y * 10));
        const out = e.dead ? Math.max(0, 1 - (now - e.deadAt) / 1800) : e.leaving ? Math.max(0, Math.min(1, (e.leaveAt - now) / 1500)) : 1;
        e.el.style.opacity = String(Math.max(0, Math.min(1, (now - e.born) / 800)) * out);
        if (e.hpEl) e.hpEl.style.width = `${Math.max(0, e.hp / e.max) * 100}%`;
        const rest = e.path.length > 0 && !e.dead ? "walk" : "idle";
        const key = `${rest}${e.flip}${e.n}`;
        if (e.key !== key) { e.key = key; e.setLook?.({ rest, flip: e.flip, act: e.act, n: e.n }); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [floor, nav]);

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div ref={world} className="absolute left-0 top-0 will-change-transform" style={{ width: floor.w * T, height: floor.h * T }}>
        <canvas ref={ground} width={floor.w * T} height={floor.h * T} className="absolute inset-0" />
        {floor.props.filter((p) => p.kind !== "entry" && p.kind !== "exit" && p.kind !== "chest").map((p) => {
          const r = A.rects[p.idx];
          const k = (p.w * T) / (r.w * (p.crop ?? 1));
          return (
            <div key={p.id} className="absolute" style={{
              left: p.x * T - (p.w * T) / 2, top: p.y * T - r.h * k, width: r.w * (p.crop ?? 1) * k, height: r.h * k,
              backgroundImage: `url(${A.url})`, backgroundSize: `${A.w * k}px ${A.h * k}px`, backgroundPosition: `${-r.x * k}px ${-r.y * k}px`,
              zIndex: p.kind === "decor" ? 4 : 10 + Math.round(p.y * 10),
            }} />
          );
        })}
        {ents.current.map((e) => <Ent key={e.id} e={e} />)}
      </div>
    </div>
  );
}

/** A made-up floor from anywhere in the tower, swapped for another every so often, under a dark veil so the title stays in focus. */
export function LiveBackdrop() {
  const [n, setN] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let alive = true;
    const roll = () => Math.max(1, Math.min(39, Math.floor(rnd(1, 40))));
    setN(roll()); requestAnimationFrame(() => setShown(true));
    const t = setInterval(() => {
      setShown(false);
      setTimeout(() => { if (alive) { setN(roll()); setShown(true); } }, 1200);
    }, 50000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const floor = useMemo(() => (n ? generateFloor(n) : null), [n]);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink" aria-hidden="true">
      <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: shown ? 1 : 0 }}>{floor && <Stage key={floor.n} floor={floor} />}</div>
      <div className="absolute inset-0 bg-ink/62" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(26,28,44,0.55) 0%, rgba(26,28,44,0.2) 45%, rgba(26,28,44,0.8) 100%)" }} />
    </div>
  );
}
