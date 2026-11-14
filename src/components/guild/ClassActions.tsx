"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ARCHETYPE_LABEL, CLASSES, NEXT_RANK, RANK_LABEL, RANK_LEVEL, RECRUITS, RECRUIT_ADVANCE_LEVEL, isRecruit } from "@/lib/guild";
import type { Rarity, Role } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  level_too_low: "Not high enough level yet.",
  sold_out: "That rank is sold out right now.",
  already_has_class: "This fighter already has a class.", recruit_first: "Novices become Recruits first.", class_not_available: "That class isn't available.",
};

/** Under a fighter card: pick a class at level 10, then climb the job ranks. */
export function ClassActions({ id, level, role, archetype, rarity }: { id: string; level: number; role: Role; archetype: string; rarity: Rarity }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>) =>
    startBusy(async () => {
      setError(null);
      const { error: e } = await fn();
      if (e) return setError(ERRORS[e.message] ?? "That didn't work. Try again.");
      setOpen(false);
      router.refresh();
    });

  const supabase = createClient();
  const isNovice = archetype === "novice";
  const next = NEXT_RANK[rarity];

  if (isNovice) {
    const ready = level >= RANK_LEVEL.common;
    const rec = RECRUITS[role];
    return (
      <div className="flex flex-col gap-2">
        {!ready ? (
          <p className="text-base text-steel">Reach level {RANK_LEVEL.common} to become a Recruit ({RANK_LEVEL.common - level} to go).</p>
        ) : (
          <PixelButton className="text-lg" disabled={busy} onClick={() => run(() => supabase.rpc("choose_class", { p_fighter: id, p_archetype: rec.id }))}>
            Become {ARCHETYPE_LABEL[rec.id]}
          </PixelButton>
        )}
        {ready && <p className="text-base text-steel">{rec.blurb}</p>}
        {error && <p role="alert" className="text-base text-ember">{error}</p>}
      </div>
    );
  }

  if (isRecruit(archetype)) {
    const ready = level >= RECRUIT_ADVANCE_LEVEL;
    return (
      <div className="flex flex-col gap-2">
        {!ready ? (
          <p className="text-base text-steel">Reach level {RECRUIT_ADVANCE_LEVEL} to choose a class ({RECRUIT_ADVANCE_LEVEL - level} to go).</p>
        ) : !open ? (
          <PixelButton className="text-lg" onClick={() => setOpen(true)}>Choose a class</PixelButton>
        ) : (
          <div className="pixel-box bg-night p-3">
            <p className="mb-2 text-lg uppercase text-gold">Pick a class</p>
            <ul className="flex flex-col gap-2">
              {CLASSES[role].map((c) => (
                <li key={c.id}>
                  <button type="button" disabled={busy} onClick={() => run(() => supabase.rpc("choose_class", { p_fighter: id, p_archetype: c.id }))} className="pixel-btn w-full bg-panel px-3 py-2 text-left text-paper">
                    <span className="block text-lg uppercase">{ARCHETYPE_LABEL[c.id]}</span>
                    <span className="block text-base text-steel">{c.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-base text-steel">You start at {RANK_LABEL.common}. This can't be undone.</p>
          </div>
        )}
        {error && <p role="alert" className="text-base text-ember">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {next ? (
        level >= RANK_LEVEL[next] ? (
          <PixelButton className="text-lg" disabled={busy} onClick={() => run(() => supabase.rpc("rank_up", { p_fighter: id }))}>
            Rank up to {RANK_LABEL[next]}
          </PixelButton>
        ) : (
          <p className="text-base text-steel">{RANK_LABEL[next]} unlocks at level {RANK_LEVEL[next]}.</p>
        )
      ) : (
        <p className="text-base text-gold">Top rank reached.</p>
      )}
      {error && <p role="alert" className="text-base text-ember">{error}</p>}
    </div>
  );
}
