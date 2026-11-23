"use client";

import { useState } from "react";
import { hasGearArt } from "@/components/gear/GearIcon";
import { MAX_RANK, RANK_TEXT, artSlug, classLabel, minLevel, rankName, statLine, statsAt, type GearBase } from "@/lib/gear";

/** One still frame (idle, first pose) of a 6x6 sprite sheet. */
function Still({ url }: { url: string }) {
  return <div className="absolute inset-0 [image-rendering:pixelated]" style={{ backgroundImage: `url(${url})`, backgroundSize: "600% 600%", backgroundPosition: "0 0", backgroundRepeat: "no-repeat" }} />;
}

/** A still look at the piece. Armour is a whole character, so the four rank buttons show how its look changes as it evolves.
 *  Weapons and shields are drawn over the novice. */
export function GearPreview({ base, rank = 1, level = 1, gender = "male", onClose }: { base: GearBase; rank?: number; level?: number; gender?: string; onClose: () => void }) {
  const [r, setR] = useState(rank);
  const g = gender === "female" ? "female" : "male";
  const armour = base.slot === "armor";
  const drawn = hasGearArt(base.slug, r);
  const stats = statsAt(base, r, r === rank ? level : 1);
  return (
    <div className="fixed inset-0 z-[9800] flex items-center justify-center bg-ink/80 p-3" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview ${base.name}`} className="pixel-box card-reveal flex max-h-[94dvh] w-full max-w-sm flex-col gap-2 overflow-y-auto bg-night p-3 text-paper">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-2xl uppercase text-gold">{base.name}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="h-9 w-9 shrink-0 bg-panel text-2xl">✕</button>
        </div>
        <div className="relative mx-auto aspect-square w-56 max-w-full bg-panel short:w-40" role="img" aria-label={drawn ? `A fighter wearing ${base.name}, ${rankName(r)}` : `${base.name} preview coming soon`}>
          {drawn && armour ? <Still url={`/sprites/${artSlug(base.slug, r)}.png`} />
            : drawn ? (<><Still url={`/sprites/novice_${g}.png`} /><Still url={`/gear/preview/${artSlug(base.slug, r)}_${g}.png`} /></>)
            : <Still url={`/sprites/novice_${g}.png`} />}
        </div>
        {!drawn && <p className="text-center text-base text-steel">This item&apos;s art isn&apos;t drawn yet.</p>}
        <div className="flex justify-center gap-1">
          {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setR(n)} aria-pressed={r === n} className={`px-3 py-1 text-lg uppercase ${r === n ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{n}</button>
          ))}
        </div>
        <p className="text-center text-base text-steel"><span className={RANK_TEXT[r]}>{rankName(r)}</span> · Lv {minLevel(r)}+ to wear · {classLabel(base)}</p>
        <p className="text-center text-lg text-leaf">{statLine(stats)}</p>
      </div>
    </div>
  );
}
