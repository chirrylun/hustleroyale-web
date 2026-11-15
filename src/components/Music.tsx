"use client";

import { useEffect } from "react";
import { isMuted } from "@/lib/sfx";

export type Track = "guild" | "arena" | "boss";
const VOLUME: Record<Track, number> = { guild: 0.35, arena: 0.35, boss: 0.4 };

/** Looping background music for a screen: /audio/<track>.mp3. Starts on the first tap if the browser blocks autoplay, follows the mute switch, and fades out when the screen closes. */
export function Music({ track }: { track: Track }) {
  useEffect(() => {
    const a = new Audio(`/audio/${track}.mp3`);
    a.loop = true;
    a.preload = "auto";
    let gone = false;
    const target = () => (isMuted() ? 0 : VOLUME[track]);
    a.volume = 0;
    const start = () => { if (!gone && a.paused) a.play().then(() => window.removeEventListener("pointerdown", start), () => {}); };
    start();
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    // Fade in, follow the mute switch.
    const tick = setInterval(() => { const t = target(); a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(t - a.volume) * Math.min(0.03, Math.abs(t - a.volume)))); }, 60);
    return () => {
      gone = true;
      clearInterval(tick);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      const out = setInterval(() => { a.volume = Math.max(0, a.volume - 0.05); if (a.volume <= 0) { clearInterval(out); a.pause(); a.src = ""; } }, 40);
    };
  }, [track]);
  return null;
}
