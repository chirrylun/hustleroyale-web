"use client";

import { useEffect, useRef, useState } from "react";
import { xpRequired, type GuildFighter } from "@/lib/guild";
import { restedFrac } from "@/lib/rest";

/** A fighter's health bar over its head in the guild. Resting heals, so the bar fills and a green +N floats up as it does, like on the floors. */
export function HealthTag({ f }: { f: Pick<GuildFighter, "hp" | "hp_frac" | "hp_at" | "xp" | "level"> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const fr = restedFrac(f.hp_frac, f.hp_at, now);
  const hp = Math.round(fr * f.hp);
  const xpPct = Math.min(100, Math.round(((f.xp ?? 0) / xpRequired(f.level)) * 100));
  const shown = useRef({ hp, at: now });
  const [pops, setPops] = useState<{ id: number; n: number }[]>([]);
  useEffect(() => {
    const gained = hp - shown.current.hp;
    if (gained <= 0) { shown.current = { hp, at: shown.current.at }; return; }
    if (now - shown.current.at < 1000) return;
    shown.current = { hp, at: now };
    const id = now;
    setPops((p) => [...p.slice(-2), { id, n: gained }]);
    const t = setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000);
    return () => clearTimeout(t);
  }, [hp, now]);
  return (
    <span className="pointer-events-none absolute left-1/2 top-[14%] block w-[44%] -translate-x-1/2">
      {pops.map((p) => (
        <span key={p.id} className="absolute bottom-full left-1/2 z-10 mb-[2px] text-[clamp(11px,1.8cqw,20px)] font-bold leading-none text-leaf" style={{ animation: "dmg 1000ms ease-out forwards", textShadow: "0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}>+{p.n}</span>
      ))}
      <span className="block h-[clamp(3px,0.7cqw,7px)] w-full bg-ink/85" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fr * 100)}>
        <span className={`block h-full ${fr < 0.3 ? "bg-ember" : "bg-leaf"}`} style={{ width: `${fr * 100}%` }} />
      </span>
      <span className="mt-[1px] block h-[clamp(2px,0.45cqw,5px)] w-full bg-ink/85" role="progressbar" aria-label="Experience" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpPct}>
        <span className="block h-full bg-[#ff9a1f]" style={{ width: `${xpPct}%` }} />
      </span>
    </span>
  );
}
