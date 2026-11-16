"use client";

import Link from "next/link";
import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { RoomScene, type SceneLayout } from "@/components/room/RoomScene";
import { Speech, SpeechActions } from "@/components/room/Speech";
import layout from "./market-layout.json";

/**
 * The market room: a shop floor with the merchant at the stall. Buying and selling comes later; for now the room is
 * where its props live, so the marketplace can grow here.
 */
export function MarketRoom() {
  const [talk, setTalk] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <div className="flex items-center gap-3 bg-night/90 px-3 py-2 text-paper">
        <Link href="/home" className="pixel-box bg-panel px-3 py-1 text-lg uppercase">← Guild</Link>
        <h1 className="text-2xl uppercase text-gold">Market</h1>
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <RoomScene layout={layout as unknown as SceneLayout} onAction={() => setTalk(true)} />
      </div>
      <p className="px-4 py-3 text-center text-xl text-steel">Tap the merchant or the stall.</p>
      {talk && (
        <Speech npc="merchant" title="Marketplace" onClose={() => setTalk(false)}>
          <p>Welcome! The stalls aren&apos;t open just yet.</p>
          <p className="text-steel">Soon you&apos;ll buy and sell fighters with other players here, and buy upgrades for your guild.</p>
          <SpeechActions>
            <PixelButton variant="ghost" onClick={() => setTalk(false)}>Okay</PixelButton>
          </SpeechActions>
        </Speech>
      )}
    </div>
  );
}
