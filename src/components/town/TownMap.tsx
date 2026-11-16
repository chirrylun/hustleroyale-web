"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { buildNav, findPath, nearestWalkable, type Pt } from "@/lib/guild-nav";
import { ATLAS, PICTURE, SCALE, TILE_PX as T, TOWNS, UNIT, navLayoutOf, type TownId, type TownProp } from "@/lib/town/maps";

const SPEED = 2.8; // tiles per second
const FRAME = 2.8; // a fighter's sprite frame, in tiles
const WORLD = PICTURE * SCALE; // the picture on screen, in px
const depth = (y: number) => 10 + Math.round((y / UNIT) * 10);
/** A tapped sign sends the party to it; this close to it counts as arrived. */
const ARRIVE = 1.7;

interface Walker {
  id: string;
  sprite: string;
  role: "tank" | "healer" | "dps";
  /** Position in tiles. */
  x: number; y: number;
  path: Pt[];
  look: { walking: boolean; flip: boolean };
  key?: string;
}
type Look = Walker["look"];
/** How the loop reaches a figure's element and its look state, by id. */
type Rig = Map<string, { el: HTMLDivElement | null; set: (l: Look) => void }>;

function Figure({ id, sprite, role, flip = false, still, rig }: { id: string; sprite: string; role: Walker["role"]; flip?: boolean; still?: boolean; rig?: Rig }) {
  const [look, setLook] = useState<Look>({ walking: false, flip });
  const size = FRAME * T;
  return (
    <div
      ref={(el) => { if (rig) { if (el) rig.set(id, { el, set: setLook }); else rig.delete(id); } }}
      className="absolute left-0 top-0 will-change-transform"
      // The feet sit at about 90% of the sprite frame, so lift the frame by that much to stand on the point.
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size * 0.88 }}
    >
      <FighterSprite spriteKey={sprite} role={role} flip={look.flip} rest={look.walking ? "walk" : "idle"} still={still} />
    </div>
  );
}

/**
 * A town map: one painted picture with props on it. Your party walks around it (tap the ground to send them
 * there; tap a sign to travel). Shopkeepers stand still for now.
 */
export function TownMap({ id, fighters }: { id: TownId; fighters: GuildFighter[] }) {
  const town = TOWNS[id];
  const router = useRouter();
  const nav = useMemo(() => buildNav(navLayoutOf(town)), [town]);
  const party = useMemo(() => {
    const team = fighters.filter((f) => f.team_slot > 0).sort((a, b) => a.team_slot - b.team_slot);
    return (team.length ? team : fighters).slice(0, 3);
  }, [fighters]);

  const [rig] = useState<Rig>(() => new Map());
  const view = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, vw: 800, vh: 600 });
  const marker = useRef<HTMLDivElement>(null);
  const goal = useRef<TownProp | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  // The party's walking state lives outside React: the loop below moves it every frame without re-rendering.
  const walkers = useMemo<Walker[]>(() => {
    const [sx, sy] = town.spawn;
    return party.map((f, i) => {
      const [x, y] = nearestWalkable(nav, sx / UNIT + (i - 1) * 1.1, sy / UNIT + (i % 2) * 0.7);
      return { id: f.id, sprite: f.template.sprite_key, role: f.template.role, x, y, path: [], look: { walking: false, flip: false } };
    });
  }, [party, town, nav]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const W = walkers;
      const lead = W[0];
      W.forEach((w, i) => {
        // Followers trail the leader at a short distance.
        if (i > 0 && lead && !w.path.length && Math.hypot(w.x - lead.x, w.y - lead.y) > 2.2) {
          w.path = findPath(nav, [w.x, w.y], [lead.x + (i % 2 ? 0.9 : -0.9), lead.y + 0.5]);
        }
        const p = w.path[0];
        if (p) {
          const dx = p[0] - w.x, dy = p[1] - w.y, d = Math.hypot(dx, dy), m = SPEED * dt;
          if (Math.abs(dx) > 0.05) w.look.flip = dx < 0;
          if (d <= m) { w.x = p[0]; w.y = p[1]; w.path.shift(); } else { w.x += (dx / d) * m; w.y += (dy / d) * m; }
        }
        w.look.walking = w.path.length > 0;
        const r = rig.get(w.id);
        if (r?.el) {
          r.el.style.transform = `translate(${w.x * T}px, ${w.y * T}px)`;
          r.el.style.zIndex = String(10 + Math.round(w.y * 10));
        }
        const key = `${w.look.walking}${w.look.flip}`;
        if (w.key !== key) { w.key = key; r?.set({ ...w.look }); }
      });

      const g = goal.current;
      if (g && lead && Math.hypot(lead.x - g.x / UNIT, lead.y - (g.y + 36) / UNIT) < ARRIVE && g.href) {
        goal.current = null;
        router.push(g.href);
      }

      // Camera: follow the leader; a picture smaller than the screen is centred.
      const c = cam.current;
      const tx = lead ? lead.x * T - c.vw / 2 : 0, ty = lead ? lead.y * T - c.vh / 2 : 0;
      c.x += (tx - c.x) * Math.min(1, dt * 6);
      c.y += (ty - c.y) * Math.min(1, dt * 6);
      c.x = WORLD <= c.vw ? (WORLD - c.vw) / 2 : Math.min(WORLD - c.vw, Math.max(0, c.x));
      c.y = WORLD <= c.vh ? (WORLD - c.vh) / 2 : Math.min(WORLD - c.vh, Math.max(0, c.y));
      if (world.current) world.current.style.transform = `translate(${-c.x}px, ${-c.y}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [walkers, nav, router, rig]);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { cam.current.vw = el.clientWidth; cam.current.vh = el.clientHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const local = (e: PointerEvent) => {
    const r = view.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onUp = (e: PointerEvent) => {
    const d = down.current, p = local(e), c = cam.current;
    down.current = null;
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 10 || performance.now() - d.t > 500) return;
    // Screen -> picture pixels.
    const px = (p.x + c.x) / SCALE, py = (p.y + c.y) / SCALE;
    // A tap on a sign (its picture) travels there; anything else is "walk here".
    const sign = town.props.find((s) => {
      if (!s.href) return false;
      const [, , w, h] = ATLAS.rects[s.i];
      return Math.abs(px - s.x) < w / 2 && py < s.y + 20 && py > s.y - h;
    });
    goal.current = sign ?? null;
    const target: Pt = sign ? [sign.x / UNIT, (sign.y + 36) / UNIT] : [px / UNIT, py / UNIT];
    const to = nearestWalkable(nav, target[0], target[1]);
    walkers.forEach((w, i) => {
      w.path = findPath(nav, [w.x, w.y], nearestWalkable(nav, to[0] + (i % 2 ? 0.8 : -0.8) * (i ? 1 : 0), to[1] + (i ? 0.6 : 0)));
    });
    setLabel(sign?.label ?? null);
    const m = marker.current;
    if (m) { m.style.left = `${to[0] * T}px`; m.style.top = `${to[1] * T}px`; m.classList.remove("marker-ping"); void m.offsetWidth; m.classList.add("marker-ping"); }
  };

  return (
    <div className="relative flex h-dvh w-full flex-col bg-ink">
      <div className="z-[9500] flex items-center gap-3 bg-night/90 px-3 py-2 text-paper">
        <Link href="/home" className="pixel-box bg-panel px-3 py-1 text-lg uppercase">← Guild</Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-lg uppercase text-gold">{town.title}</p>
          <p className="truncate text-sm text-steel">Tap the ground to walk · tap a sign to travel</p>
        </div>
        {label && <p className="text-lg text-gold">→ {label}</p>}
      </div>

      <div
        ref={view}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={(e) => { down.current = { ...local(e), t: performance.now() }; }}
        onPointerUp={onUp}
      >
        <div ref={world} className="absolute left-0 top-0 will-change-transform" style={{ width: WORLD, height: WORLD }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={town.ground} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
          {town.props.map((p, k) => {
            const [rx, ry, rw, rh] = ATLAS.rects[p.i];
            return (
              <div
                key={k}
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  left: (p.x - rw / 2) * SCALE, top: (p.y - rh) * SCALE, width: rw * SCALE, height: rh * SCALE,
                  backgroundImage: "url(/town/props.png)", backgroundSize: `${ATLAS.w * SCALE}px ${ATLAS.h * SCALE}px`,
                  backgroundPosition: `${-rx * SCALE}px ${-ry * SCALE}px`, zIndex: depth(p.y),
                }}
              />
            );
          })}
          {town.props.filter((p) => p.href).map((p, k) => (
            <span
              key={k}
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap bg-night/80 px-1.5 text-base uppercase text-gold"
              style={{ left: p.x * SCALE, top: p.y * SCALE + 6, zIndex: 9000 }}
            >
              {p.label}
            </span>
          ))}
          {town.npcs.map((n, k) => (
            <div key={k} className="absolute left-0 top-0" style={{ transform: `translate(${(n.x / UNIT) * T}px, ${(n.y / UNIT) * T}px)`, zIndex: 10 + Math.round((n.y / UNIT) * 10) }}>
              <Figure id={`npc${k}`} sprite={n.sprite} role={n.role} flip={n.flip} still />
            </div>
          ))}
          <div ref={marker} className="marker pointer-events-none absolute z-[5] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold opacity-0" />
          {walkers.map((w) => <Figure key={w.id} id={w.id} sprite={w.sprite} role={w.role} rig={rig} />)}
        </div>
      </div>
    </div>
  );
}
