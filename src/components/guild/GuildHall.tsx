"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import layout from "./layout.json";

type Prop = (typeof layout.props)[number] & { href?: string; action?: string; label?: string };
interface Pos { x: number; y: number; ms: number; flip: boolean; walking: boolean }

const F = layout.floor;
const SPEED = 9; // percent of hall width per second
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Top-down guild hall: fighters wander on their own; tap one, then tap the floor to send it there. */
export function GuildHall({ fighters, onAction, highlight }: { fighters: GuildFighter[]; onAction: (a: string) => void; highlight?: string }) {
  const [pos, setPos] = useState<Record<string, Pos>>(() =>
    Object.fromEntries(fighters.map((f) => [f.id, { x: rnd(F.x0, F.x1), y: rnd(F.y0, F.y1), ms: 0, flip: false, walking: false }])),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const hall = useRef<HTMLDivElement>(null);
  const timers = useRef<Record<string, number>>({});
  const held = useRef<string | null>(null); // a player-directed fighter doesn't wander until it arrives
  const posRef = useRef(pos);
  posRef.current = pos;

  const moveTo = (id: string, tx: number, ty: number) => {
    const cur = posRef.current[id];
    if (!cur) return;
    const x = clamp(tx, F.x0, F.x1), y = clamp(ty, F.y0, F.y1);
    const ms = Math.max(400, (Math.hypot(x - cur.x, (y - cur.y) * 1.78) / SPEED) * 1000);
    setPos((p) => ({ ...p, [id]: { x, y, ms, flip: x < cur.x, walking: true } }));
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      setPos((p) => ({ ...p, [id]: { ...p[id], ms: 0, walking: false } }));
      if (held.current === id) held.current = null;
      wander(id, rnd(1500, 4500));
    }, ms);
  };

  const wander = (id: string, delay: number) => {
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      const cur = posRef.current[id];
      if (!cur) return;
      // Short strolls near where it stands feel natural; sometimes it just idles.
      if (Math.random() < 0.25) return wander(id, rnd(2000, 5000));
      moveTo(id, cur.x + rnd(-14, 14), cur.y + rnd(-9, 9));
    }, delay);
  };

  useEffect(() => {
    fighters.forEach((f) => wander(f.id, rnd(300, 3000)));
    const t = timers.current;
    return () => Object.values(t).forEach((h) => window.clearTimeout(h as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighters.length]);

  const onFloor = (e: PointerEvent<HTMLDivElement>) => {
    if (!selected || !hall.current) return;
    const r = hall.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
    if (y < F.y0 - 4) return;
    held.current = selected;
    moveTo(selected, x, y);
  };

  const props = layout.props as Prop[];
  const sorted = useMemo(() => fighters, [fighters]);

  return (
    <div
      ref={hall}
      onPointerDown={onFloor}
      className="relative w-full select-none overflow-hidden"
      style={{ aspectRatio: "16 / 9", backgroundImage: "url(/guild/hall.png)", backgroundSize: "100% 100%", imageRendering: "pixelated", containerType: "inline-size" }}
    >
      {props.map((p) => {
        const style = { left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` };
        const cls = "group absolute z-[5] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
        const glow = highlight === p.id ? " animate-pulse outline outline-4 outline-gold" : "";
        const tag = (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 text-[clamp(10px,1.6cqw,18px)] uppercase text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {p.id === "adventure" ? "Adventure (soon)" : p.id}
          </span>
        );
        if (p.href) return <Link key={p.id} href={p.href} className={cls + glow} style={style} aria-label={p.id} onPointerDown={(e) => e.stopPropagation()}>{tag}</Link>;
        if (p.action) return <button key={p.id} type="button" className={cls + glow} style={style} aria-label={p.id} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(p.action!)}>{tag}</button>;
        return null;
      })}

      {sorted.map((f) => {
        const p = pos[f.id];
        if (!p) return null;
        const sel = selected === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-label={`${f.template.name}, level ${f.level}`}
            aria-pressed={sel}
            onPointerDown={(e) => { e.stopPropagation(); setSelected(sel ? null : f.id); }}
            className="absolute -translate-x-1/2 -translate-y-[85%] cursor-pointer"
            style={{
              left: `${p.x}%`, top: `${p.y}%`, width: "9cqw", zIndex: 10 + Math.round(p.y),
              transition: p.ms ? `left ${p.ms}ms linear, top ${p.ms}ms linear` : undefined,
            }}
          >
            {sel && <span className="absolute bottom-[10%] left-1/2 h-[10%] w-[70%] -translate-x-1/2 rounded-full border-2 border-gold bg-gold/20" />}
            <span className="pointer-events-none absolute -top-[6%] left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink/80 px-1 text-[clamp(9px,1.3cqw,15px)] text-paper">Lv {f.level}</span>
            <FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} rest={p.walking ? "walk" : "idle"} flip={p.flip} />
          </button>
        );
      })}
    </div>
  );
}
