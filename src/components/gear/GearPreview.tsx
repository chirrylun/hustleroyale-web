"use client";

import { useState, type ReactNode } from "react";

import { GearIcon, hasGearArt } from "@/components/gear/GearIcon";
import { MAX_LEVEL, RANK_TEXT, artSlug, classLabel, maxRankOf, minLevel, rankName, statsAt, type GearBase } from "@/lib/gear";

const STATS = [["ATK", "atk"], ["DEF", "def"], ["MAG", "magic"], ["HP", "hp"], ["SPD", "spd"]] as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-paper/10 py-1 text-lg last:border-0">
      <span className="shrink-0 text-steel">{label}</span>
      <span className="min-w-0 text-right text-paper">{children}</span>
    </div>
  );
}

/** One still frame (idle, first pose) of a 6x6 sprite sheet. */
function Still({ url }: { url: string }) {
  return <div className="absolute inset-0 [image-rendering:pixelated]" style={{ backgroundImage: `url(${url})`, backgroundSize: "600% 600%", backgroundPosition: "0 0", backgroundRepeat: "no-repeat" }} />;
}

/** What a piece is, in numbers: rank, level, stats, who can wear it, and whether it can still be enhanced or evolved. */
export function GearPreview({ base, rank = 1, level = 1, gender = "male", onClose }: { base: GearBase; rank?: number; level?: number; gender?: string; onClose: () => void }) {
  const stats = statsAt(base, rank, level);
  const top = maxRankOf(base);
  const canEnhance = level < MAX_LEVEL;
  const canEvolve = rank < top;
  const [look, setLook] = useState(false);
  const g = gender === "female" ? "female" : "male";
  const drawn = hasGearArt(base.slug, rank);
  const armour = base.slot === "armor";
  const sheet = base.slug === "armor_novice" ? `${artSlug(base.slug, rank)}_${g}` : artSlug(base.slug, rank);
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

        {look ? (
          <>
            <div className="relative mx-auto aspect-square w-56 max-w-full bg-panel short:w-40" role="img" aria-label={drawn ? `A fighter wearing ${base.name}` : `${base.name} preview coming soon`}>
              {drawn && armour ? <Still url={`/sprites/${sheet}.png`} />
                : drawn ? (<><Still url={`/sprites/novice_${g}.png`} /><Still url={`/gear/preview/${artSlug(base.slug, rank)}_${g}.png`} /></>)
                : <Still url={`/sprites/novice_${g}.png`} />}
            </div>
            {!drawn && <p className="text-center text-base text-steel">This item&apos;s art isn&apos;t drawn yet.</p>}
            <button type="button" onClick={() => setLook(false)} className="bg-panel px-3 py-1 text-xl uppercase text-paper">Back to details</button>
          </>
        ) : (
          <>
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
              <Row label="Enhance">{canEnhance ? <span className="text-leaf">Can enhance</span> : <span className="text-steel">Maxed</span>}</Row>
              <Row label="Evolve">{canEvolve ? <span className="text-leaf">Can evolve</span> : <span className="text-steel">Can&apos;t evolve</span>}</Row>
            </div>
            <button type="button" onClick={() => setLook(true)} className="bg-gold px-3 py-1 text-xl uppercase text-ink">Preview</button>
          </>
        )}
      </div>
    </div>
  );
}
