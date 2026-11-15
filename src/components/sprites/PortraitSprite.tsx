"use client";

import { useEffect, useState } from "react";
import { FighterSprite } from "./FighterSprite";
import type { Role } from "@/lib/sprites/designs";

/**
 * A fighter that stays alive on a card: it idles, now and then takes a few slow steps to one side (turning
 * to face the way it goes), then idles again. `seed` staggers cards so a row of them never moves in unison.
 */
export function PortraitSprite({ spriteKey, role, seed = 0 }: { spriteKey: string; role: Role; seed?: number }) {
  const [walking, setWalking] = useState(false);
  const [x, setX] = useState(0); // -1 .. 1, as a share of the room to roam
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    let t: ReturnType<typeof setTimeout>, off = false;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const idle = (ms: number) => { t = setTimeout(() => { if (off) return; setX((p) => (p > 0.3 ? -rnd(0.3, 1) : p < -0.3 ? rnd(0.3, 1) : Math.random() < 0.5 ? -1 : 1) * 0.9); setWalking(true); t = setTimeout(() => { if (!off) { setWalking(false); idle(rnd(2200, 5200)); } }, 1700); }, ms); };
    idle(rnd(500, 2500) + (seed % 7) * 260);
    return () => { off = true; clearTimeout(t); };
  }, [seed]);

  return (
    <div
      className="w-full"
      style={{ transform: `translateX(${x * 14}%)`, transition: walking ? "transform 1.7s linear" : undefined }}
    >
      <FighterSprite spriteKey={spriteKey} role={role} rest={walking ? "walk" : "idle"} flip={x < 0 && walking ? true : x < 0} still={still} tempo={0.8} />
    </div>
  );
}
