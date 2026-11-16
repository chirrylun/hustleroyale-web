"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { restedFrac } from "@/lib/rest";
import { createClient } from "@/lib/supabase/client";
import { isBossFloor, themeOf } from "@/lib/world/floor";

const PARTY_MAX = 3;
const ROLE_LABEL = { tank: "Tank", healer: "Healer", dps: "Damage" } as const;

/** Pick who goes out, right in the guild. Heading out saves the party as the player's team (XP goes to them), then the floor loads. */
export function PartyPanel({ floorNo, fighters, onBack, onGo }: { floorNo: number; fighters: GuildFighter[]; onBack: () => void; onGo: () => void }) {
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
  // Resting in the guild heals everyone, so the bars fill while you watch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const add = (id: string) => setIds((p) => (p.includes(id) || p.length >= PARTY_MAX ? p : [...p, id]));
  const remove = (id: string) => setIds((p) => p.filter((x) => x !== id));
  const sendAll = () => setIds([...fighters].sort((a, b) => b.level - a.level).slice(0, PARTY_MAX).map((f) => f.id));

  const go = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("set_party", { p_ids: ids });
    if (e) { setError("Couldn't set your party. Try again."); setBusy(false); return; }
    onGo();
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <p className="text-base uppercase leading-none text-steel">{theme.name}</p>
          <h1 className="text-3xl uppercase leading-tight text-gold">Floor {floorNo}{isBossFloor(floorNo) && " · Boss"}</h1>
        </div>
        <p className="pb-1 text-lg text-steel">{chosen.length}/{PARTY_MAX} going</p>
      </header>

      <section aria-label="Your party" className="grid grid-cols-3 gap-2">
        {Array.from({ length: PARTY_MAX }, (_, i) => {
          const f = chosen[i];
          return f ? (
            <div key={f.id} className="pixel-box relative flex h-36 min-w-0 flex-col items-center justify-between bg-panel px-1 pb-1.5 pt-0 text-center">
              <button type="button" onClick={() => remove(f.id)} aria-label={`Remove ${f.template.name}`} className="absolute right-0.5 top-0.5 z-10 h-5 w-5 bg-ink/80 text-base leading-5 text-ember">×</button>
              <div className="-mb-3 -mt-1 h-24 w-24"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} /></div>
              <div className="w-full">
                <p className="truncate text-base leading-4 text-gold">{f.template.name}</p>
                <p className="text-sm leading-4 text-steel">Lv {f.level} · {ROLE_LABEL[f.template.role]}</p>
                <HpBar f={f} now={now} compact />
              </div>
            </div>
          ) : (
            <button
              key={`slot${i}`} type="button" disabled={fighters.length <= i}
              onClick={() => { const next = fighters.find((x) => !ids.includes(x.id)); if (next) add(next.id); }}
              aria-label="Add a fighter"
              className="flex h-36 items-center justify-center border-2 border-dashed border-steel/60 bg-ink/40 text-4xl leading-none text-steel enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-40"
            >+</button>
          );
        })}
      </section>

      <section aria-label="Your fighters">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-lg uppercase text-gold">Your fighters</h2>
          <div className="flex gap-1">
            <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={() => setIds([])} disabled={!ids.length}>Clear</PixelButton>
            <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={sendAll} disabled={fighters.length === 0}>Best</PixelButton>
          </div>
        </div>
        <div className="grid max-h-[30vh] grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5">
          {fighters.map((f) => {
            const on = ids.includes(f.id);
            return (
              <button
                key={f.id} type="button" onClick={() => (on ? remove(f.id) : add(f.id))} disabled={!on && full}
                aria-pressed={on} aria-label={`${f.template.name}, level ${f.level}`}
                className={`relative flex min-w-0 flex-col items-center border-2 px-0.5 pb-1 pt-0.5 text-center enabled:hover:brightness-125 disabled:opacity-40 ${on ? "border-gold bg-gold/15" : "border-steel/40 bg-panel"}`}
              >
                <div className="-mb-2 -mt-1 h-16 w-16"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} still /></div>
                <span className="w-full truncate text-sm leading-4 text-paper">{f.template.name}</span>
                <span className="text-sm leading-4 text-steel">Lv {f.level}</span>
                <HpBar f={f} now={now} compact />
                {on && <span className="absolute left-0 top-0 bg-gold px-1 text-sm leading-4 text-ink">✓</span>}
              </button>
            );
          })}
        </div>
        {error && <p role="alert" className="mt-2 text-xl text-ember">{error}</p>}
      </section>

      <div className="flex gap-2">
        <PixelButton variant="ghost" className="flex-none" onClick={onBack}>Back</PixelButton>
        <PixelButton className="flex-1 text-xl" disabled={!chosen.length || busy} onClick={go}>{busy ? "…" : `Head out to Floor ${floorNo}`}</PixelButton>
      </div>
    </div>
  );
}

function HpBar({ f, now, compact = false }: { f: GuildFighter; now: number; compact?: boolean }) {
  const fr = restedFrac(f.hp_frac, f.hp_at, now);
  return (
    <div className="relative mt-0.5 w-full px-0.5">
      <div className="h-1.5 w-full bg-ink/80" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fr * 100)}>
        <div className={`h-full ${fr < 0.3 ? "bg-ember" : "bg-leaf"}`} style={{ width: `${fr * 100}%` }} />
      </div>
      {!compact && <span className="block text-sm leading-none text-steel">{Math.round(fr * f.hp)}/{f.hp}</span>}
    </div>
  );
}
