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
export function PartyPanel({ floorNo, fighters, onBack, onGo, title, kicker, goLabel, startWithOne = false }: {
  floorNo?: number; fighters: GuildFighter[]; onBack: () => void; onGo: (ids: string[]) => void;
  /** Heading, small line above it and the go button's words, for places that aren't a floor (the lobby). */
  title?: string; kicker?: string; goLabel?: string;
  /** Begin with a single fighter chosen instead of the whole team. */
  startWithOne?: boolean;
}) {
  // Start from the current team (or the strongest fighters if none is set).
  const [ids, setIds] = useState<string[]>(() => {
    const team = fighters.filter((f) => f.team_slot > 0).sort((a, b) => a.team_slot - b.team_slot).map((f) => f.id);
    return (team.length ? team : [...fighters].sort((a, b) => b.level - a.level).map((f) => f.id)).slice(0, startWithOne ? 1 : PARTY_MAX);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const chosen = ids.map((id) => byId.get(id)!).filter(Boolean);
  const theme = floorNo ? themeOf(floorNo) : null;
  const full = ids.length >= PARTY_MAX;
  // Resting in the guild heals everyone, so the bars fill while you watch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const add = (id: string) => setIds((p) => (p.includes(id) || p.length >= PARTY_MAX ? p : [...p, id]));
  const remove = (id: string) => setIds((p) => p.filter((x) => x !== id));
  const lead = (id: string) => setIds((p) => [id, ...p.filter((x) => x !== id)]);
  const sendAll = () => setIds([...fighters].sort((a, b) => b.level - a.level).slice(0, PARTY_MAX).map((f) => f.id));

  const go = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("set_party", { p_ids: ids });
    if (e) { setError("Couldn't set your party. Try again."); setBusy(false); return; }
    onGo(ids);
  };

  return (
    <div className="flex flex-col gap-4 short:gap-2">
      <header className="flex items-end justify-between gap-2">
        <div>
          <p className="text-base uppercase leading-none text-steel">{theme?.name ?? kicker}</p>
          <h1 className="text-3xl uppercase leading-tight text-gold short:text-2xl">{floorNo ? <>Floor {floorNo}{isBossFloor(floorNo) && " · Boss"}</> : title}</h1>
        </div>
        <p className="pb-1 text-lg text-steel">{chosen.length}/{PARTY_MAX} going</p>
      </header>

      <p className="-mt-2 text-base text-steel short:hidden">Tap a fighter below to add them. Tap × to remove. The first card is your leader.</p>

      <div className="grid gap-4 short:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] short:gap-3">
      <section aria-label="Your party" className="grid grid-cols-3 content-start gap-2">
        {Array.from({ length: PARTY_MAX }, (_, i) => {
          const f = chosen[i];
          return f ? (
            <div key={f.id} className={`pixel-box relative flex h-32 min-w-0 flex-col items-center justify-between bg-panel px-1 pb-1.5 pt-0 text-center short:h-[7.5rem] ${i === 0 ? "!border-gold" : ""}`}>
              <span className={`absolute left-0.5 top-0.5 z-10 px-1 text-sm leading-4 ${i === 0 ? "bg-gold text-ink" : "bg-ink/80 text-steel"}`}>{i === 0 ? "Leader" : i + 1}</span>
              {i > 0 && <button type="button" onClick={() => lead(f.id)} aria-label={`Make ${f.template.name} the leader`} className="absolute bottom-0.5 right-0.5 z-10 bg-ink/80 px-1 text-sm leading-4 text-gold">★</button>}
              <button type="button" onClick={() => remove(f.id)} aria-label={`Remove ${f.template.name}`} className="absolute right-0.5 top-0.5 z-10 h-5 w-5 bg-ink/80 text-base leading-5 text-ember">×</button>
              <div className="-mb-3 -mt-1 h-20 w-20 short:h-[4.5rem] short:w-[4.5rem]"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} /></div>
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
              className="flex h-32 short:h-[7.5rem] items-center justify-center border-2 border-dashed border-steel/60 bg-ink/40 text-4xl leading-none text-steel enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-40"
            >+</button>
          );
        })}
      </section>

      <section aria-label="Your fighters" className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="whitespace-nowrap text-lg uppercase text-gold short:text-base">Your fighters</h2>
          <div className="flex gap-1">
            <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={() => setIds([])} disabled={!ids.length}>Clear</PixelButton>
            <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={sendAll} disabled={fighters.length === 0}>Best</PixelButton>
          </div>
        </div>
        <div className="grid max-h-[34dvh] short:max-h-[44dvh] grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5 short:grid-cols-4">
          {fighters.map((f) => {
            const on = ids.includes(f.id);
            return (
              <button
                key={f.id} type="button" onClick={() => (on ? remove(f.id) : add(f.id))} disabled={!on && full}
                aria-pressed={on} aria-label={`${f.template.name}, level ${f.level}`}
                className={`relative flex min-w-0 flex-col items-center border-2 px-0.5 pb-1 pt-0.5 text-center enabled:hover:brightness-125 disabled:opacity-40 ${on ? "border-gold bg-gold/15" : "border-steel/40 bg-panel"}`}
              >
                <div className="-mb-2 -mt-1 h-14 w-14 short:h-11 short:w-11"><FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} still /></div>
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
      </div>

      <div className="sticky bottom-0 flex gap-2 bg-night/90 py-1">
        <PixelButton variant="ghost" className="flex-none" onClick={onBack}>Back</PixelButton>
        <PixelButton className="flex-1 text-xl" disabled={!chosen.length || busy} onClick={go}>{busy ? "…" : goLabel ?? `Head out to Floor ${floorNo}`}</PixelButton>
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
