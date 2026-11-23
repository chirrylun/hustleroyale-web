"use client";

import { useState } from "react";
import { hasGearArt } from "@/components/gear/GearIcon";
import { FighterSprite, type Action } from "@/components/sprites/FighterSprite";
import { RANK_NAME, RANK_TEXT, classLabel, statLine, type GearItem } from "@/lib/gear";

type Move = Action | "idle" | "walk";
const ARMOUR_MOVES: { id: Move; label: string }[] = [{ id: "idle", label: "Idle" }, { id: "walk", label: "Walk" }, { id: "attack", label: "Attack" }, { id: "cast", label: "Cast" }];
// The novice sheet already has a sword baked into its attack and cast poses, so a weapon is shown in the poses where the body is empty-handed.
const WEAPON_MOVES: { id: Move; label: string }[] = [{ id: "idle", label: "Idle" }, { id: "walk", label: "Walk" }];

/** Shows a fighter wearing the item: an armour set is a whole character; a weapon or shield is drawn over the novice. */
export function GearPreview({ item, gender = "male", onClose }: { item: GearItem; gender?: string; onClose: () => void }) {
  const [move, setMove] = useState<Move>("idle");
  const [n, setN] = useState(0);
  const g = gender === "female" ? "female" : "male";
  const armour = item.slot === "armor";
  const drawn = hasGearArt(item.slug);
  const act = move === "idle" || move === "walk" ? null : move;
  const rest = move === "walk" ? "walk" : "idle";
  const moves = armour ? ARMOUR_MOVES : WEAPON_MOVES;
  return (
    <div className="fixed inset-0 z-[9800] flex items-center justify-center bg-ink/80 p-3" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview ${item.name}`} className="pixel-box card-reveal flex max-h-[94dvh] w-full max-w-sm flex-col gap-2 overflow-y-auto bg-night p-3 text-paper">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-2xl uppercase text-gold">{item.name}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="h-9 w-9 shrink-0 bg-panel text-2xl">✕</button>
        </div>
        <div className="relative mx-auto aspect-square w-56 max-w-full bg-panel short:w-40" role="img" aria-label={drawn ? `A fighter wearing ${item.name}` : `${item.name} preview coming soon`}>
          {drawn ? (
            armour ? (
              <FighterSprite spriteKey={item.slug} role="dps" rest={rest} action={act} actionKey={n} />
            ) : (
              <>
                <div className="absolute inset-0"><FighterSprite spriteKey={`novice_${g}`} role="dps" rest={rest} action={act} actionKey={n} /></div>
                <div className="absolute inset-0"><FighterSprite spriteKey={`gear_${item.slug}_${g}`} role="dps" rest={rest} action={act} actionKey={n} /></div>
              </>
            )
          ) : (
            <div className="absolute inset-0"><FighterSprite spriteKey={`novice_${g}`} role="dps" rest={rest} action={act} actionKey={n} /></div>
          )}
        </div>
        {!drawn && <p className="text-center text-base text-steel">This item&apos;s art isn&apos;t drawn yet.</p>}
        <div className="flex justify-center gap-1">
          {moves.map((m) => (
            <button key={m.id} type="button" onClick={() => { setMove(m.id); setN((x) => x + 1); }} className={`px-3 py-1 text-lg uppercase ${move === m.id ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{m.label}</button>
          ))}
        </div>
        <p className="text-center text-base text-steel"><span className={RANK_TEXT[item.rank]}>{RANK_NAME[item.rank]}</span> · Lv {item.min_level}+ · {classLabel(item)}</p>
        <p className="text-center text-lg text-leaf">{statLine(item)}</p>
      </div>
    </div>
  );
}
