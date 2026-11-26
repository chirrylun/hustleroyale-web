"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FighterCard } from "@/components/pack/FighterCard";
import { ClassActions } from "@/components/guild/ClassActions";
import { ROSTER_CAP, loadFighters, type GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { UiIcon } from "@/components/ui/UiIcon";
import { EquipmentTab } from "@/components/gear/EquipmentTab";

type Tab = "fighters" | "equipment";

/** Your fighters from anywhere: the same cards as My Fighters in the guild, and a tab to equip them. */
export function FightersMenu({ onClose, guide = false, onWorn }: { onClose: () => void; guide?: boolean; onWorn?: (worn: boolean) => void }) {
  const [list, setList] = useState<GuildFighter[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("fighters");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { if (live) setError(true); return; }
      const f = await loadFighters(sb, user.id);
      if (live) setList(f);
    })().catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  return (
    <div data-ui className="fixed inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-3 short:p-2" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }} onPointerMove={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-label="My Fighters" className="pixel-box flex max-h-full w-full max-w-md flex-col bg-night sm:max-w-3xl">
        <div className="flex items-stretch gap-1 border-b-2 border-steel p-2">
          <button type="button" role="tab" aria-selected={tab === "fighters"} onClick={() => setTab("fighters")} className={`flex flex-1 items-center justify-center gap-2 px-2 py-1 text-xl uppercase ${tab === "fighters" ? "bg-gold text-ink" : "bg-panel text-paper"}`}>
            My Fighters{list && <span className="min-w-6 bg-ink/20 px-1 text-base">{list.length}/{ROSTER_CAP}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === "equipment"} onClick={() => setTab("equipment")} className={`flex flex-1 items-center justify-center px-2 py-1 text-xl uppercase ${tab === "equipment" ? "bg-gold text-ink" : "bg-panel text-paper"} ${guide && tab !== "equipment" ? "tut-blink" : ""}`}>Equipment</button>
          <button type="button" aria-label="Close" onClick={onClose} className="w-10 bg-panel text-2xl text-paper">✕</button>
        </div>
        {guide && tab !== "equipment" && <p className="bg-gold/90 px-3 py-1 text-center text-base text-ink">Tap the blinking Equipment tab.</p>}
        <div className="min-h-48 overflow-y-auto p-3 short:min-h-24 short:p-2">
          {tab === "equipment" ? <EquipmentTab guide={guide} onWorn={onWorn} onDone={onClose} />
            : error ? <p role="alert" className="text-xl text-ember">Couldn&apos;t load your fighters. Try again.</p>
            : list === null ? <div className="h-40 animate-pulse bg-panel" aria-busy="true" />
            : list.length === 0 ? <p className="text-xl text-paper">No fighters yet.</p>
            : (
              <div className="grid gap-3 sm:grid-cols-2 short:grid-cols-3">
                {list.map((f, i) => (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <FighterCard fighter={f} delayMs={i * 80} compact />
                    <Link href={`/team/${f.id}`} className="pixel-btn bg-panel px-3 py-0.5 text-center text-base uppercase text-paper">Skills ({f.skill_points ?? 0} points)</Link>
                    <ClassActions id={f.id} level={f.level} role={f.template.role} archetype={f.template.archetype} rarity={f.template.rarity} />
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/** The roster icon button; sits with the bag button. */
export function FightersButton({ onClick, blink = false }: { onClick: () => void; blink?: boolean }) {
  return (
    <button
      type="button" aria-label="My Fighters" onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      className={`pixel-box flex h-12 w-12 short:h-10 short:w-10 items-center justify-center bg-night/90 text-2xl leading-none ${blink ? "tut-blink" : ""}`}
    >
      <UiIcon name="crown" size={30} />
    </button>
  );
}
