"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { restedFrac } from "@/lib/rest";
import { createClient } from "@/lib/supabase/client";
import { isBossFloor, themeOf } from "@/lib/world/floor";

const PARTY_MAX = 3;
const ROLE_LABEL = { tank: "Tank", healer: "Healer", dps: "Damage" } as const;

/** Pick who goes out, right in the guild. Heading out saves the party as the player's team (XP goes to them), then the floor loads. */
export function PartyPanel({ floorNo, fighters, onBack, onGo }: { floorNo: number; fighters: GuildFighter[]; onBack: () => void; onGo: (roomCode?: string) => void }) {
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
  const [code, setCode] = useState("");
  const sendAll = () => setIds([...fighters].sort((a, b) => b.level - a.level).slice(0, PARTY_MAX).map((f) => f.id));

  const go = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("set_party", { p_ids: ids });
    if (e) { setError("Couldn't set your party. Try again."); setBusy(false); return; }
    onGo(code.trim() || undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <section>
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
                <HpBar f={f} now={now} />
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

      <section aria-label="Your fighters">
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
                <HpBar f={f} now={now} />
                {on ? <span className="absolute left-1 top-1 bg-leaf px-1 text-ink">✓</span> : !full && <span className="absolute left-1 top-1 bg-gold px-1 text-ink">+</span>}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-lg text-steel">
          Friend&apos;s room code
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8))}
            placeholder="optional" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="Friend's room code"
            className="pixel-box w-28 bg-night px-2 py-1 text-center text-xl uppercase tracking-widest text-paper placeholder:text-steel/60"
          />
        </label>
        {error && <p role="alert" className="mt-2 text-xl text-ember">{error}</p>}
      </section>

      <div className="flex gap-2">
        <PixelButton variant="ghost" className="flex-none" onClick={onBack}>Back</PixelButton>
        <PixelButton className="flex-1 text-xl" disabled={!chosen.length || busy} onClick={go}>{busy ? "…" : `Head out to Floor ${floorNo}`}</PixelButton>
      </div>
    </div>
  );
}

function HpBar({ f, now }: { f: GuildFighter; now: number }) {
  const fr = restedFrac(f.hp_frac, f.hp_at, now);
  const hp = Math.round(fr * f.hp);
  const shown = useRef({ hp, at: now });
  const [pops, setPops] = useState<{ id: number; n: number }[]>([]);
  // Like on the field: a green +N floats up each second the fighter heals.
  useEffect(() => {
    const gained = hp - shown.current.hp;
    if (gained <= 0) { shown.current = { hp, at: shown.current.at }; return; }
    if (now - shown.current.at < 1000) return;
    shown.current = { hp, at: now };
    const id = now;
    setPops((p) => [...p.slice(-2), { id, n: gained }]);
    const t = setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000);
    return () => clearTimeout(t);
  }, [hp, now]);
  return (
    <div className="relative mt-0.5 w-full">
      {pops.map((p) => (
        <span key={p.id} className="pointer-events-none absolute bottom-full left-1/2 z-10 text-base font-bold leading-none text-leaf" style={{ animation: "dmg 1000ms ease-out forwards", textShadow: "0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}>+{p.n}</span>
      ))}
      <div className="h-1.5 w-full bg-ink/80" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fr * 100)}>
        <div className={`h-full ${fr < 0.3 ? "bg-ember" : "bg-leaf"}`} style={{ width: `${fr * 100}%` }} />
      </div>
      <span className="block text-sm leading-none text-steel">{hp}/{f.hp}</span>
    </div>
  );
}
