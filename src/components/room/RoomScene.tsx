"use client";

import Link from "next/link";
import { useMemo, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Npc, npcRatio, type Facing, type NpcName } from "@/components/npc/Npc";

export interface SceneProp {
  id: string;
  label?: string;
  x: number; y: number; w: number; h: number;
  foot: number[] | null;
  href?: string;
  action?: string;
}
export interface SceneNpc { id: string; npc: string; x: number; y: number; h: number; facing: string; action?: string; foot: number[] }
export interface SceneLayout {
  cols: number; rows: number; frame: number;
  floor: { x0: number; x1: number; y0: number; y1: number };
  props: SceneProp[];
  npcs: SceneNpc[];
  /** Where players arrive. */
  arrive?: number[];
}

export const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** Things in front hide things behind: stack by how far down the floor a thing stands. */
export const depth = (bottom: number) => 10 + Math.round(bottom * 10);
const depthOf = (p: SceneProp) => (p.foot ? depth(p.foot[3]) : 2);

/**
 * A room drawn over the guild hall's floor: props you can tap (they act or link), people standing about, and whatever
 * the page puts on top (fighters). The page owns what happens when the floor is tapped.
 */
export function RoomScene({ layout, onAction, innerRef, onPointerDown, children }: {
  layout: SceneLayout;
  onAction: (action: string) => void;
  innerRef?: RefObject<HTMLDivElement | null>;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}) {
  const sorted = useMemo(() => [...layout.props].sort((p, q) => depthOf(p) - depthOf(q)), [layout.props]);
  const cls = "group absolute outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
  return (
    <div
      ref={innerRef}
      onPointerDown={onPointerDown}
      className="relative isolate w-full select-none overflow-hidden"
      style={{ aspectRatio: `${layout.cols} / ${layout.rows}`, backgroundImage: "url(/guild/hall.png)", backgroundSize: "100% 100%", containerType: "inline-size" }}
    >
      {sorted.map((p) => {
        const box = { left: pct(p.x, layout.cols), top: pct(p.y, layout.rows), width: pct(p.w, layout.cols), height: pct(p.h, layout.rows), zIndex: depthOf(p) };
        // eslint-disable-next-line @next/next/no-img-element
        const art = <img src={`/guild/props/${p.id.replace(/_\d+$/, "")}.png`} alt="" draggable={false} className="pointer-events-none h-full w-full" />;
        const tag = !p.label ? null : (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 text-[clamp(10px,1.6cqw,18px)] uppercase text-paper">{p.label}</span>
        );
        if (p.href) return <Link key={p.id} href={p.href} className={cls} style={box} aria-label={p.label ?? p.id} onPointerDown={(e) => e.stopPropagation()}>{art}{tag}</Link>;
        if (p.action) return <button key={p.id} type="button" className={cls} style={box} aria-label={p.label ?? p.id} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(p.action!)}>{art}{tag}</button>;
        return <div key={p.id} className="pointer-events-none absolute" style={box}>{art}</div>;
      })}

      {layout.npcs.map((n) => {
        const w = n.h * npcRatio(n.npc as NpcName);
        const box = { left: pct(n.x - w / 2, layout.cols), top: pct(n.y - n.h, layout.rows), width: pct(w, layout.cols), zIndex: depth(n.foot[3]) };
        const art = <Npc name={n.npc as NpcName} facing={n.facing as Facing} className="pointer-events-none w-full" />;
        if (n.action) return <button key={n.id} type="button" className={cls} style={box} aria-label={n.npc.replace("_", " ")} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(n.action!)}>{art}</button>;
        return <div key={n.id} className="pointer-events-none absolute" style={box}>{art}</div>;
      })}

      {children}
    </div>
  );
}
