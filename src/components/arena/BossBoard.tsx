"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { fmtTime, type BoardRow } from "@/lib/arena";
import type { BossId, RangeId } from "@/lib/battle";
import { createClient } from "@/lib/supabase/client";

/** The fastest teams to beat one boss in one level range, each with a small outline of its fighters. */
export function BossBoard({ boss, range, refresh = 0 }: { boss: BossId; range: RangeId; /** Change to reload (after a new win). */ refresh?: number }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [key, setKey] = useState("");
  const want = `${boss}:${range}:${refresh}`;

  useEffect(() => {
    let off = false;
    void createClient().rpc("boss_rush_board", { p_boss: boss, p_range: range, p_limit: 10 }).then(({ data }) => {
      if (off) return;
      setRows((data as BoardRow[] | null) ?? []);
      setKey(want);
    });
    return () => { off = true; };
  }, [boss, range, want]);

  if (rows === null || key !== want) return <div className="h-24 animate-pulse bg-panel" aria-busy="true" />;
  if (rows.length === 0) return <p className="text-lg text-steel">No team has beaten this boss yet. Be the first.</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.rank} className={clsx("pixel-box flex items-center gap-2 p-1.5", r.you ? "bg-gold text-ink" : "bg-panel text-paper")}>
          <span className="w-7 shrink-0 text-center text-xl">{r.rank}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-lg uppercase">{r.name}{r.you ? " (you)" : ""}</p>
            <p className={clsx("text-base", r.you ? "text-ink" : "text-gold")}>{fmtTime(r.time_ms)}</p>
          </div>
          <div className="flex shrink-0 -space-x-2" aria-label={`Team: ${r.team.map((m) => `${m.name} level ${m.level}`).join(", ")}`}>
            {r.team.map((m, i) => (
              <div key={i} className="relative h-12 w-12 overflow-hidden" title={`${m.name} · Lv ${m.level}`}>
                <div className="absolute inset-x-0 -bottom-1 scale-[1.3]"><FighterSprite spriteKey={m.spriteKey} role={m.role} still /></div>
                <span className="absolute bottom-0 right-0 bg-ink px-0.5 text-[10px] leading-3 text-paper">{m.level}</span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
