"use client";

import { GearIcon } from "@/components/gear/GearIcon";
import { UiIcon } from "@/components/ui/UiIcon";
import { MAX_LEVEL, RANK_TEXT, classLabel, enhanceCost, evolveCost, maxRankOf, minLevel, rankName, statsAt, type GearBase } from "@/lib/gear";

const STATS = [["ATK", "atk"], ["DEF", "def"], ["MAG", "magic"], ["HP", "hp"], ["SPD", "spd"]] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-paper/10 py-1 text-lg last:border-0">
      <span className="shrink-0 text-steel">{label}</span>
      <span className="min-w-0 text-right text-paper">{children}</span>
    </div>
  );
}

/** What a piece is, in numbers: rank, level, stats, who can wear it, and whether it can still be enhanced or evolved. */
export function GearPreview({ base, rank = 1, level = 1, onClose }: { base: GearBase; rank?: number; level?: number; gender?: string; onClose: () => void }) {
  const stats = statsAt(base, rank, level);
  const top = maxRankOf(base);
  const canEnhance = level < MAX_LEVEL;
  const canEvolve = rank < top;
  const coin = <UiIcon name="coins" size={16} />;
  return (
    <div className="fixed inset-0 z-[9800] flex items-center justify-center bg-ink/80 p-3" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${base.name} details`} className="pixel-box card-reveal flex max-h-[94dvh] w-full max-w-sm flex-col gap-2 overflow-y-auto bg-night p-3 text-paper">
        <div className="flex items-center gap-2">
          <GearIcon base={base.slug} kind={base.kind} rank={rank} size={48} />
          <div className="min-w-0 flex-1 leading-tight">
            <h3 className="truncate text-2xl uppercase text-gold">{base.name}</h3>
            <p className={`text-lg ${RANK_TEXT[rank]}`}>{rankName(rank)} · Lv {level}/{MAX_LEVEL}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="h-9 w-9 shrink-0 bg-panel text-2xl">✕</button>
        </div>

        <div className="grid grid-cols-5 gap-1 text-center" aria-label="Stats">
          {STATS.map(([label, k]) => (
            <div key={k} className={`px-0.5 py-1 leading-none ${stats[k] ? "bg-panel" : "bg-panel/40 opacity-50"}`}>
              <p className="text-sm text-steel">{label}</p>
              <p className={`text-xl ${stats[k] ? "text-leaf" : "text-steel"}`}>{stats[k] ? `+${stats[k]}` : "–"}</p>
            </div>
          ))}
        </div>

        <div className="bg-panel px-2">
          <Row label="Worn by">{classLabel(base)}</Row>
          <Row label="Level needed">Lv {minLevel(rank)}+</Row>
          <Row label="Enhance">
            {canEnhance ? <span className="text-leaf">Yes · to Lv {level + 1} for <span className="inline-flex items-center gap-0.5 align-middle">{enhanceCost(base, rank, level)}{coin}</span></span> : <span className="text-steel">Maxed (Lv {MAX_LEVEL})</span>}
          </Row>
          <Row label="Evolve">
            {canEvolve
              ? <span className="text-leaf">Yes · Rank {rank + 1} at Lv {MAX_LEVEL}, <span className="inline-flex items-center gap-0.5 align-middle">{evolveCost(base, rank)}{coin}</span></span>
              : <span className="text-steel">No · {top === 1 ? "one rank only" : "top rank"}</span>}
          </Row>
        </div>
      </div>
    </div>
  );
}
