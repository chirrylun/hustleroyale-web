"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { isBossFloor, themeOf } from "@/lib/world/floor";
import { FloorScreen } from "./FloorScreen";

const PARTY_MAX = 3;
const ROLE_LABEL = { tank: "Tank", healer: "Healer", dps: "Damage" } as const;

/** Pick who goes out, then walk onto the floor. The chosen party is saved as the player's team, so XP goes to them. */
export function FloorEntry({ floorNo, fighters, tutorialStep, floorUnlocked }: { floorNo: number; fighters: GuildFighter[]; tutorialStep: number; floorUnlocked: number }) {
  const [party, setParty] = useState<GuildFighter[] | null>(null);
  if (party) return <FloorScreen floorNo={floorNo} fighters={party} tutorialStep={tutorialStep} floorUnlocked={floorUnlocked} />;
  return <PartySelect floorNo={floorNo} fighters={fighters} onGo={setParty} />;
}

function PartySelect({ floorNo, fighters, onGo }: { floorNo: number; fighters: GuildFighter[]; onGo: (p: GuildFighter[]) => void }) {
  // Start from the current team (or the strongest fighters if none is set).
  const [ids, setIds] = useState<string[]>(() => {
    const team = fighters.filter((f) => f.team_slot > 0).sort((a, b) => a.team_slot - b.team_slot).map((f) => f.id);
    return (team.length ? team : [...fighters].sort((a, b) => b.level - a.level).map((f) => f.id)).slice(0, PARTY_MAX);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const chosen = ids.map((id) => byId.get(id)!).filter(Boolean);
  const theme = themeOf(floorNo);
  const full = ids.length >= PARTY_MAX;

  const add = (id: string) => setIds((p) => (p.includes(id) || p.length >= PARTY_MAX ? p : [...p, id]));
  const remove = (id: string) => setIds((p) => p.filter((x) => x !== id));
  const sendAll = () => setIds([...fighters].sort((a, b) => b.level - a.level).slice(0, PARTY_MAX).map((f) => f.id));

  const go = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("set_party", { p_ids: ids });
    if (e) { setError("Couldn't set your party. Try again."); setBusy(false); return; }
    onGo(chosen.map((f, i) => ({ ...f, team_slot: i + 1 })));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-3 p-3 sm:p-6">
      <section className="pixel-box card-reveal bg-night p-4 sm:p-5">
        <p className="text-base uppercase text-steel">{theme.name}</p>
        <h1 className="mb-1 text-3xl uppercase text-gold">Floor {floorNo}{isBossFloor(floorNo) && " · Boss"}</h1>
        <p className="mb-3 text-xl text-paper">Choose who goes out. Send one fighter or the whole party.</p>

        <div className="grid grid-cols-3 gap-2" aria-label="Your party">
          {Array.from({ length: PARTY_MAX }, (_, i) => {
            const f = chosen[i];
            return f ? (
              <div key={f.id} className="pixel-box relative flex min-w-0 flex-col items-center bg-panel p-2 text-center text-base">
                <button type="button" onClick={() => remove(f.id)} aria-label={`Remove ${f.template.name}`} className="absolute right-1 top-1 z-10 h-6 w-6 bg-ink/80 text-lg leading-6 text-ember">×</button>
                <div className="w-full max-w-24"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} /></div>
                <span className="w-full truncate text-gold">{f.template.name}</span>
                <span className="text-steel">{ROLE_LABEL[f.template.role]} · Lv {f.level}</span>
              </div>
            ) : (
              <button
                key={`slot${i}`} type="button" disabled={fighters.length <= i}
                onClick={() => { const next = fighters.find((x) => !ids.includes(x.id)); if (next) add(next.id); }}
                aria-label="Add a fighter"
                className="flex min-h-32 flex-col items-center justify-center gap-1 border-2 border-dashed border-steel/60 bg-ink/40 text-steel enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-40"
              >
                <span className="text-5xl leading-none">+</span>
                <span className="text-base uppercase">Empty</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-lg text-steel">{chosen.length} of {PARTY_MAX} going</p>
          <div className="flex gap-2">
            <PixelButton variant="ghost" className="text-base" onClick={() => setIds([])} disabled={!ids.length}>Clear</PixelButton>
            <PixelButton variant="ghost" className="text-base" onClick={sendAll} disabled={fighters.length === 0}>Send best</PixelButton>
          </div>
        </div>
      </section>

      <section className="pixel-box bg-night p-4" aria-label="Your fighters">
        <h2 className="mb-2 text-xl uppercase text-gold">Your fighters</h2>
        <div className="grid max-h-[34vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {fighters.map((f) => {
            const on = ids.includes(f.id);
            return (
              <button
                key={f.id} type="button" onClick={() => (on ? remove(f.id) : add(f.id))} disabled={!on && full}
                className={`pixel-box relative flex min-w-0 flex-col items-center p-1.5 text-center text-sm enabled:hover:brightness-125 disabled:opacity-40 ${on ? "bg-leaf/25" : "bg-panel"}`}
                aria-pressed={on}
              >
                <div className="w-full max-w-16"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} still /></div>
                <span className="w-full truncate text-paper">{f.template.name}</span>
                <span className="text-steel">{ROLE_LABEL[f.template.role]} · Lv {f.level}</span>
                {on ? <span className="absolute left-1 top-1 bg-leaf px-1 text-ink">✓</span> : !full && <span className="absolute left-1 top-1 bg-gold px-1 text-ink">+</span>}
              </button>
            );
          })}
        </div>
        {error && <p role="alert" className="mt-2 text-xl text-ember">{error}</p>}
      </section>

      <div className="flex gap-2">
        <Link href="/home" className="flex-none"><PixelButton variant="ghost" className="h-full">Back</PixelButton></Link>
        <PixelButton className="flex-1 text-xl" disabled={!chosen.length || busy} onClick={go}>{busy ? "…" : `Enter Floor ${floorNo}`}</PixelButton>
      </div>
    </main>
  );
}
