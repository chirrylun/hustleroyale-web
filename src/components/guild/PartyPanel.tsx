"use client";

import { LiveSprite } from "@/components/sprites/LiveSprite";
import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FirstTip } from "@/components/training/FirstTip";
import { ARCHETYPE_LABEL, type GuildFighter } from "@/lib/guild";
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
    <div className="flex flex-col gap-3 short:gap-2">
      <header className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base uppercase leading-none text-steel">{theme?.name ?? kicker}</p>
          <h1 className="text-3xl uppercase leading-tight text-gold short:text-2xl">{floorNo ? <>Floor {floorNo}{isBossFloor(floorNo) && " · Boss"}</> : title}</h1>
        </div>
        <p className={`shrink-0 pb-1 text-lg ${full ? "text-leaf" : "text-steel"}`}>{chosen.length}/{PARTY_MAX} going</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] short:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <section aria-label="Your party" className="min-w-0">
          <h2 className="mb-1 text-base uppercase text-gold">Your party</h2>
          <div className="grid grid-cols-3 content-start gap-2 sm:grid-cols-1 short:grid-cols-1">
            {Array.from({ length: PARTY_MAX }, (_, i) => {
              const f = chosen[i];
              return f ? (
                <div key={f.id} className={`pixel-box relative flex min-w-0 flex-col items-center bg-panel px-1 pb-1.5 text-center sm:h-24 sm:flex-row sm:gap-2 sm:px-2 sm:text-left short:h-[4.5rem] ${i === 0 ? "!border-gold" : ""}`}>
                  <span className={`absolute left-0.5 top-0.5 z-10 px-1 text-sm leading-4 ${i === 0 ? "bg-gold text-ink" : "bg-ink/80 text-steel"}`}>{i === 0 ? "Leader" : "Member"}</span>
                  <button type="button" onClick={() => remove(f.id)} aria-label={`Remove ${f.template.name}`} className="absolute right-0.5 top-0.5 z-10 h-6 w-6 bg-ink/80 text-lg leading-6 text-ember">×</button>
                  <div className="-mb-2 mt-3 h-16 w-16 shrink-0 sm:mb-0 sm:mt-2 sm:h-16 short:mt-0 short:h-14 short:w-14"><LiveSprite id={f.id} spriteKey={f.template.sprite_key} role={f.template.role} /></div>
                  <div className="min-w-0 flex-1 self-stretch sm:self-center">
                    <p className="truncate text-base leading-4 text-gold">{f.template.name}</p>
                    <p className="truncate text-sm leading-4 text-steel">Lv {f.level} · {ARCHETYPE_LABEL[f.template.archetype] ?? ROLE_LABEL[f.template.role]}</p>
                    <HpBar f={f} now={now} compact />
                    {i > 0 && <button type="button" onClick={() => lead(f.id)} className="mt-0.5 text-sm leading-4 text-gold underline sm:block">Make leader</button>}
                  </div>
                </div>
              ) : (
                <button
                  key={`slot${i}`} type="button" disabled={fighters.length <= i}
                  onClick={() => { const next = fighters.find((x) => !ids.includes(x.id)); if (next) add(next.id); }}
                  aria-label="Add a fighter"
                  className="flex h-28 flex-col items-center justify-center gap-0.5 border-2 border-dashed border-steel/60 bg-ink/40 text-steel enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-40 sm:h-24 short:h-[4.5rem]"
                ><span className="text-3xl leading-none">+</span><span className="text-sm uppercase leading-4">Add</span></button>
              );
            })}
          </div>
        </section>

        <section aria-label="Your fighters" className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-base uppercase text-gold">Your fighters</h2>
            <div className="flex gap-1">
              <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={() => setIds([])} disabled={!ids.length}>Clear</PixelButton>
              <PixelButton variant="ghost" className="px-2 py-0 text-base" onClick={sendAll} disabled={fighters.length === 0}>Best</PixelButton>
            </div>
          </div>
          <ul className="grid max-h-[36dvh] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:max-h-[44dvh] sm:grid-cols-2 short:max-h-[48dvh]">
            {fighters.map((f) => {
              const on = ids.includes(f.id);
              return (
                <li key={f.id} className="min-w-0">
                  <button
                    type="button" onClick={() => (on ? remove(f.id) : add(f.id))} disabled={!on && full}
                    aria-pressed={on} aria-label={`${f.template.name}, level ${f.level}`}
                    className={`flex w-full min-w-0 items-center gap-2 border-2 px-1.5 py-1 text-left enabled:hover:brightness-125 disabled:opacity-40 ${on ? "border-gold bg-gold/15" : "border-steel/40 bg-panel"}`}
                  >
                    <span className="-my-1 block h-12 w-12 shrink-0"><LiveSprite id={f.id} spriteKey={f.template.sprite_key} role={f.template.role} still /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base leading-4 text-paper">{f.template.name}</span>
                      <span className="block truncate text-sm leading-4 text-steel">Lv {f.level} · {ARCHETYPE_LABEL[f.template.archetype] ?? ROLE_LABEL[f.template.role]}</span>
                      <HpBar f={f} now={now} compact />
                    </span>
                    <span className={`shrink-0 px-1.5 text-sm uppercase leading-5 ${on ? "bg-gold text-ink" : "bg-ink/70 text-steel"}`}>{on ? "✓ In" : "Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="mt-2 text-xl text-ember">{error}</p>}
        </section>
      </div>

      <FirstTip tip="party" title="Choose your party">
        <p>Tap a fighter to add them to the party, or tap them again to take them out. You can bring up to three.</p>
        <p>The first one is your leader. The bar under each fighter is their health: resting in the guild heals them.</p>
        <p className="text-steel">When you are ready, press the button at the bottom to head out.</p>
      </FirstTip>
      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-night px-1 py-1">
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
