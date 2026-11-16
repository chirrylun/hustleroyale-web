"use client";

import type { ReactNode } from "react";
import { Npc, type NpcName } from "@/components/npc/Npc";
import { PixelButton } from "@/components/pixel/PixelButton";

/** An NPC speaking: their portrait, a heading and some words, plus whatever buttons or panels the page puts below. */
export function Speech({ npc, title, onClose, children, wide = false }: { npc: NpcName; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[9700] flex items-end justify-center bg-ink/70 p-3 sm:items-center"
      onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`pixel-box card-reveal flex max-h-[90dvh] w-full flex-col bg-night p-4 ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="flex items-start gap-3">
          <Npc name={npc} className="w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-2xl uppercase text-gold">{title}</h2>
            <div className="flex flex-col gap-2 text-xl text-paper">{children}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="h-9 w-9 shrink-0 bg-panel text-2xl text-paper">✕</button>
        </div>
      </div>
    </div>
  );
}

export function SpeechActions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-2">{children}</div>;
}

export { PixelButton };
