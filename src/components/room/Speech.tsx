"use client";

import type { ReactNode } from "react";
import { Npc, type NpcName } from "@/components/npc/Npc";
import { PixelButton } from "@/components/pixel/PixelButton";

/** An NPC speaking: their portrait, a heading and some words, plus whatever buttons or panels the page puts below. */
export function Speech({ npc, title, onClose, children, wide = false, shop = false }: { npc: NpcName; title: string; onClose: () => void; children: ReactNode; wide?: boolean; shop?: boolean }) {
  if (shop) return <ShopSpeech npc={npc} title={title} onClose={onClose}>{children}</ShopSpeech>;
  return (
    <div
      className="fixed inset-0 z-[9700] flex items-end justify-center bg-ink/70 p-3 sm:items-center short:items-center short:p-2"
      onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`pixel-box card-reveal flex max-h-[94dvh] w-full flex-col overflow-y-auto bg-night p-4 short:max-w-2xl short:p-2.5 ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="flex items-start gap-3">
          <Npc name={npc} className="w-16 shrink-0 short:w-12" />
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-2xl uppercase text-gold short:text-xl">{title}</h2>
            <div className="flex flex-col gap-2 text-xl text-paper short:gap-1 short:text-base">{children}</div>
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

/**
 * A shop window: the NPC's portrait and title across the top, and the whole width below for the goods, so nothing is squeezed
 * beside the portrait on a phone. The window is tall on small screens and the list in the middle scrolls; the buttons stay in view.
 */
function ShopSpeech({ npc, title, onClose, children }: { npc: NpcName; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[9700] flex items-end justify-center bg-ink/70 p-2 sm:items-center sm:p-3"
      onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="pixel-box card-reveal flex h-[92dvh] w-full max-w-xl flex-col bg-night p-3 sm:h-auto sm:max-h-[90dvh] short:h-[96dvh] short:max-w-3xl short:p-2">
        <div className="flex shrink-0 items-center gap-3 pb-2 short:gap-2 short:pb-1">
          <Npc name={npc} className="w-14 shrink-0 short:w-10" />
          <h2 className="min-w-0 flex-1 truncate text-2xl uppercase text-gold short:text-xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="h-10 w-10 shrink-0 bg-panel text-2xl text-paper">✕</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 text-xl text-paper short:gap-1 short:text-base">{children}</div>
      </div>
    </div>
  );
}
