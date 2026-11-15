"use client";

import { useEffect } from "react";
import { isMuted } from "@/lib/sfx";

export type Track = "intro" | "guild" | "arena" | "boss" | "floors-1" | "floors-2";
const VOLUME: Record<Track, number> = { intro: 0.4, guild: 0.35, arena: 0.35, boss: 0.4, "floors-1": 0.3, "floors-2": 0.3 };

/** The floor song for a floor number: 1-9 and 11-19 have their own; boss floors (10, 20, ...) use the boss song. */
export const floorTrack = (n: number, boss: boolean): Track => (boss ? "boss" : n < 10 ? "floors-1" : "floors-2");

/** One song plays at a time. Moving between screens that want the same song keeps it playing instead of restarting it. */
let cur: { track: Track; a: HTMLAudioElement; stop?: ReturnType<typeof setTimeout> } | null = null;

const fadeOut = (a: HTMLAudioElement) => {
  const out = setInterval(() => { a.volume = Math.max(0, a.volume - 0.05); if (a.volume <= 0) { clearInterval(out); a.pause(); a.src = ""; } }, 40);
};

/** Looping background music for a screen: /audio/<track>.mp3. Starts on the first tap if the browser blocks autoplay, follows the mute switch, and fades out when the screen closes. */
export function Music({ track }: { track: Track }) {
  useEffect(() => {
    if (cur && cur.track === track) { if (cur.stop) clearTimeout(cur.stop); cur.stop = undefined; }
    else {
      if (cur) { clearTimeout(cur.stop); fadeOut(cur.a); }
      const a = new Audio(`/audio/${track}.mp3`);
      a.loop = true; a.preload = "auto"; a.volume = 0;
      cur = { track, a };
    }
    const me = cur!;
    const a = me.a;
    const target = () => (isMuted() ? 0 : VOLUME[track]);
    const start = () => { if (a.paused) a.play().then(() => { window.removeEventListener("pointerdown", start); window.removeEventListener("keydown", start); }, () => {}); };
    start();
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    const tick = setInterval(() => { const t = target(); a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(t - a.volume) * Math.min(0.03, Math.abs(t - a.volume)))); }, 60);
    return () => {
      clearInterval(tick);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      // Wait a moment: the next screen may want the same song.
      me.stop = setTimeout(() => { if (cur === me) { cur = null; } fadeOut(a); }, 400);
    };
  }, [track]);
  return null;
}
