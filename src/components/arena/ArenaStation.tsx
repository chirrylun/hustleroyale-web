"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { BOSSES, RANGES, bossSprite, fmtTime } from "@/lib/arena";
import type { BossId, RangeId } from "@/lib/battle";
import { createClient } from "@/lib/supabase/client";
import { BossBoard } from "./BossBoard";

export type Station = "challenge" | "boss" | "raid";
export const STATION_TITLE: Record<Station, string> = { challenge: "Challenge", boss: "Boss Rush", raid: "Floor Raid" };
const LINE: Record<Station, string> = { challenge: "Fight an AI team. Pick their level.", boss: "Beat a floor boss. Fastest teams are ranked.", raid: "Climb all the floors in one go." };

function Pick({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={clsx("pixel-btn text-left", on ? "bg-gold text-ink" : "bg-panel text-paper", className)}>{children}</button>;
}

/** What an arena NPC offers: a level range, for Boss Rush a boss (with the board), and a button that starts the fight. */
export function ArenaStation({ station }: { station: Station }) {
  const [range, setRange] = useState<RangeId>("10-20");
  const [boss, setBoss] = useState<BossId | null>(null);
  const [mine, setMine] = useState<Record<string, number>>({});
  const def = RANGES.find((r) => r.id === range)!;
  const bossId: BossId = boss && def.bosses.includes(boss) ? boss : def.bosses[0];

  useEffect(() => {
    if (station !== "boss") return;
    let off = false;
    void createClient().rpc("boss_rush_mine").then(({ data }) => {
      if (!off) setMine(Object.fromEntries(((data as { boss: string; range: string; time_ms: number }[] | null) ?? []).map((r) => [`${r.boss}:${r.range}`, r.time_ms])));
    });
    return () => { off = true; };
  }, [station]);

  const href = `/arena/fight?mode=${station}&range=${range}${station === "boss" ? `&boss=${bossId}` : ""}`;

  return (
    <>
      <p>{LINE[station]}</p>
      <div role="group" aria-label="Level range" className="grid grid-cols-3 gap-2">
        {RANGES.map((r) => <Pick key={r.id} on={range === r.id} onClick={() => setRange(r.id)} className="px-1 py-2 text-center text-xl uppercase">Lv {r.min}-{r.max}</Pick>)}
      </div>

      {station === "boss" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {def.bosses.map((id) => (
              <Pick key={id} on={bossId === id} onClick={() => setBoss(id)} className="flex flex-col items-center gap-0.5 p-2 text-center">
                <span className="relative h-20 w-20 overflow-hidden" aria-hidden="true"><span className="absolute inset-x-0 -bottom-1 block scale-[1.1]"><FighterSprite spriteKey={bossSprite(id)} role={BOSSES[id].role} still /></span></span>
                <span className="text-lg uppercase leading-tight">{BOSSES[id].name}</span>
                <span className={clsx("text-sm leading-tight", bossId === id ? "text-ink" : "text-steel")}>Lv {BOSSES[id].level} · {mine[`${id}:${range}`] ? `Best ${fmtTime(mine[`${id}:${range}`])}` : "Not beaten"}</span>
              </Pick>
            ))}
          </div>
          <div className="max-h-56 overflow-y-auto pr-1"><BossBoard boss={bossId} range={range} /></div>
        </>
      )}

      <Link href={href} className="pixel-btn mt-1 block bg-leaf py-3 text-center text-2xl uppercase text-ink">{station === "boss" ? `Fight ${BOSSES[bossId].name}` : station === "challenge" ? "Fight the AI" : "Start"}</Link>
      {station === "challenge" && <Link href={`/arena/fight?mode=pvp&range=${range}`} className="pixel-btn mt-2 block bg-gold py-3 text-center text-2xl uppercase text-ink">Fight a player</Link>}
    </>
  );
}
