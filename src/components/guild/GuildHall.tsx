"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { buildNav, findPath, nearestWalkable, randomWalkable, type Pt } from "@/lib/guild-nav";
import layout from "./layout.json";

interface Prop {
  id: string;
  group: string;
  x: number; y: number; w: number; h: number;
  foot: number[] | null;
  wall: boolean;
  href?: string;
  action?: string;
  spot?: number[];
  emote?: string;
  work?: string;
}

/** What the browser draws for one fighter. Position lives outside React (see `Agent`) so walking costs no re-renders. */
interface Look { walking: boolean; flip: boolean; emote?: string; working: boolean; beat: number }

/** Where one fighter is and what it is up to. Updated every animation frame. */
interface Agent {
  x: number; y: number;
  path: Pt[];
  /** Player-directed: the fighter ignores its own plans until it gets there. */
  held: boolean;
  /** Visiting a prop: where it is headed and how it will behave once there. */
  visit: Prop | null;
  nextAt: number; // when an idle fighter picks something new to do
  dwellUntil: number;
  beatAt: number;
}

const IDLE: Look = { walking: false, flip: false, working: false, beat: 0 };
const SPEED = 2.6; // tiles per second
const FRAME = layout.frame; // a fighter's sprite frame, in tiles
const props = layout.props as Prop[];
const spots = props.filter((p) => p.spot);
const nav = buildNav(layout);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** Things in front hide things behind: stack by how far down the floor a thing stands. */
const depth = (bottom: number) => 10 + Math.round(bottom * 10);

/**
 * The guild hall: a room full of furniture the fighters walk around, never through. They wander,
 * stop at the job board, the hearth, the training dummies and so on, and you can tap one then tap
 * the floor to send it somewhere.
 */
export function GuildHall({ fighters, onAction, highlight }: { fighters: GuildFighter[]; onAction: (a: string) => void; highlight?: string }) {
  const [looks, setLooks] = useState<Record<string, Look>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const hall = useRef<HTMLDivElement>(null);
  const agents = useRef(new Map<string, Agent>());
  const els = useRef(new Map<string, HTMLElement>());

  const patch = (id: string, l: Partial<Look>) =>
    setLooks((all) => {
      const cur = all[id] ?? IDLE;
      const next = { ...cur, ...l };
      return all[id] && (Object.keys(next) as (keyof Look)[]).every((k) => next[k] === cur[k]) ? all : { ...all, [id]: next };
    });

  /** A new fighter appears at a free spot of the floor (created when its element mounts, so nothing random runs while rendering). */
  const ensureAgent = (id: string) => {
    const map = agents.current;
    if (map.has(id)) return map.get(id)!;
    const taken = [...map.values()];
    let at = randomWalkable(nav, Math.random);
    for (let n = 0; n < 10 && taken.some((t) => Math.hypot(t.x - at[0], t.y - at[1]) < 2); n++) at = randomWalkable(nav, Math.random);
    const a: Agent = { x: at[0], y: at[1], path: [], held: false, visit: null, nextAt: 0, dwellUntil: 0, beatAt: 0 };
    map.set(id, a);
    return a;
  };

  const ids = fighters.map((f) => f.id).join(",");
  useEffect(() => {
    const live = new Set(ids.split(","));
    for (const id of [...agents.current.keys()]) if (!live.has(id)) { agents.current.delete(id); els.current.delete(id); }
  }, [ids]);

  useEffect(() => {
    const map = agents.current;
    // Somewhere a fighter can stand at a prop without crowding someone who is already there.
    const pickVisit = (self: string): Prop | null => {
      const free = spots.filter((p) => {
        const s = nearestWalkable(nav, p.spot![0], p.spot![1]);
        return ![...map.entries()].some(([id, a]) => id !== self && (Math.hypot(a.x - s[0], a.y - s[1]) < 1.3 || (a.visit === p && a.path.length)));
      });
      return free.length ? free[Math.floor(Math.random() * free.length)] : null;
    };

    const go = (id: string, a: Agent, to: Pt) => {
      a.path = findPath(nav, [a.x, a.y], to);
      if (a.path.length) patch(id, { walking: true, emote: undefined, working: false });
    };

    let last = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      for (const [id, a] of map) {
        if (!a.nextAt) a.nextAt = t + rnd(300, 2500); // a new arrival waits a moment before doing anything
        if (a.path.length) {
          const target = a.path[0];
          const dx = target[0] - a.x, dy = target[1] - a.y;
          const d = Math.hypot(dx, dy);
          const step = SPEED * dt;
          if (Math.abs(dx) > 0.02) patch(id, { flip: dx < 0 });
          if (d <= step) {
            a.x = target[0]; a.y = target[1];
            a.path.shift();
          } else {
            a.x += (dx / d) * step; a.y += (dy / d) * step;
          }
          if (!a.path.length) {
            // Arrived.
            a.held = false;
            const v = a.visit;
            if (v) {
              a.dwellUntil = t + rnd(3500, 7500);
              a.nextAt = a.dwellUntil;
              a.beatAt = t + 400;
              // Face the prop it came to use.
              patch(id, { walking: false, flip: v.x + v.w / 2 < a.x, emote: v.work ? undefined : v.emote, working: !!v.work });
            } else {
              a.nextAt = t + rnd(1500, 4500);
              patch(id, { walking: false });
            }
          }
          const el = els.current.get(id);
          if (el) {
            el.style.left = pct(a.x, layout.cols);
            el.style.top = pct(a.y, layout.rows);
            el.style.zIndex = String(depth(a.y));
          }
        } else if (a.visit && a.dwellUntil && t < a.dwellUntil) {
          // Using a prop: swing at a dummy now and then.
          if (a.visit.work && t >= a.beatAt) {
            a.beatAt = t + rnd(900, 1500);
            setLooks((all) => (all[id] ? { ...all, [id]: { ...all[id], beat: all[id].beat + 1 } } : all));
          }
        } else if (!a.held && t >= a.nextAt) {
          // Pick something new: usually go and use a prop, sometimes stroll, sometimes just stand.
          a.visit = null;
          a.dwellUntil = 0;
          patch(id, { emote: undefined, working: false });
          const roll = Math.random();
          if (roll < 0.55) {
            const v = pickVisit(id);
            if (v) { a.visit = v; go(id, a, [v.spot![0], v.spot![1]]); }
          } else if (roll < 0.85) {
            go(id, a, randomWalkable(nav, Math.random, [a.x, a.y], 7));
          }
          if (!a.path.length) { a.visit = null; a.nextAt = t + rnd(2000, 5000); }
        }
        // Keep the DOM in step even when standing still the first frame.
        const el = els.current.get(id);
        if (el && !el.style.left) {
          el.style.left = pct(a.x, layout.cols);
          el.style.top = pct(a.y, layout.rows);
          el.style.zIndex = String(depth(a.y));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // The loop reads everything through refs, so it starts once.
  }, []);

  const onFloor = (e: PointerEvent<HTMLDivElement>) => {
    if (!selected || !hall.current) return;
    const a = agents.current.get(selected);
    if (!a) return;
    const r = hall.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * layout.cols;
    const y = ((e.clientY - r.top) / r.height) * layout.rows;
    if (y < layout.floor.y0 - 0.6) return; // that's the wall
    a.held = true;
    a.visit = null;
    a.dwellUntil = 0;
    a.path = findPath(nav, [a.x, a.y], nearestWalkable(nav, x, y));
    if (a.path.length) patch(selected, { walking: true, emote: undefined, working: false });
    else a.held = false;
  };

  const sorted = useMemo(() => [...props].sort((p, q) => depthOf(p) - depthOf(q)), []);
  const frameW = (FRAME / layout.cols) * 100;

  return (
    <div
      ref={hall}
      onPointerDown={onFloor}
      className="relative w-full select-none overflow-hidden"
      style={{ aspectRatio: `${layout.cols} / ${layout.rows}`, backgroundImage: "url(/guild/hall.png)", backgroundSize: "100% 100%", containerType: "inline-size" }}
    >
      {sorted.map((p) => {
        const box = { left: pct(p.x, layout.cols), top: pct(p.y, layout.rows), width: pct(p.w, layout.cols), height: pct(p.h, layout.rows), zIndex: depthOf(p) };
        // eslint-disable-next-line @next/next/no-img-element
        const art = <img src={`/guild/props/${p.id}.png`} alt="" draggable={false} className="pointer-events-none h-full w-full" />;
        const hot = highlight === p.group;
        const tag = (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 text-[clamp(10px,1.6cqw,18px)] uppercase text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {p.group === "adventure" ? "Adventure (soon)" : p.group}
          </span>
        );
        const cls = "group absolute outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold" + (hot ? " animate-pulse outline outline-4 outline-gold" : "");
        if (p.href) return <Link key={p.id} href={p.href} className={cls} style={box} aria-label={p.group} onPointerDown={(e) => e.stopPropagation()}>{art}{tag}</Link>;
        if (p.action) return <button key={p.id} type="button" className={cls} style={box} aria-label={p.group} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(p.action!)}>{art}{tag}</button>;
        return <div key={p.id} className="pointer-events-none absolute" style={box}>{art}</div>;
      })}

      {fighters.map((f) => {
        const look = looks[f.id] ?? IDLE;
        const sel = selected === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-label={`${f.template.name}, level ${f.level}`}
            aria-pressed={sel}
            ref={(el) => {
              if (!el) return;
              els.current.set(f.id, el);
              const a = ensureAgent(f.id);
              el.style.left = pct(a.x, layout.cols);
              el.style.top = pct(a.y, layout.rows);
              el.style.zIndex = String(depth(a.y));
              el.style.visibility = "visible"; // hidden until placed, so it never flashes in a corner
            }}
            onPointerDown={(e) => { e.stopPropagation(); setSelected(sel ? null : f.id); }}
            className="absolute -translate-x-1/2 -translate-y-[90%] cursor-pointer"
            style={{ width: `${frameW}%`, visibility: "hidden" }}
          >
            <span className="pointer-events-none absolute bottom-[8%] left-1/2 h-[7%] w-[34%] -translate-x-1/2 rounded-full bg-ink/40" />
            {sel && <span className="absolute bottom-[6%] left-1/2 h-[11%] w-[44%] -translate-x-1/2 rounded-full border-2 border-gold bg-gold/20" />}
            <span className="pointer-events-none absolute left-1/2 top-[21%] -translate-x-1/2 whitespace-nowrap bg-ink/80 px-1 text-[clamp(9px,1.3cqw,15px)] text-paper">Lv {f.level}</span>
            {look.emote && <span className="pointer-events-none absolute left-[62%] top-[6%] text-[clamp(12px,2.2cqw,26px)] leading-none">{look.emote}</span>}
            <FighterSprite
              spriteKey={f.template.sprite_key}
              role={f.template.role}
              rest={look.walking ? "walk" : "idle"}
              flip={look.flip}
              action={look.working && look.beat > 0 ? "attack" : null}
              actionKey={look.beat}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Stacking key of a prop: its bottom edge, so a fighter standing below it is drawn in front. Floor decor sits under everyone. */
function depthOf(p: Prop): number {
  if (p.wall) return 1;
  if (!p.foot) return 2;
  return depth(p.foot[3]);
}
