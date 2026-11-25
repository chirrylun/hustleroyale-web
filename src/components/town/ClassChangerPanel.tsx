"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ARCHETYPE_LABEL, RANK_LABEL } from "@/lib/guild";
import type { Rarity } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";

interface Fighter { id: string; name: string; level: number; archetype: string; rarity: Rarity }
interface Option { archetype: string; tier: number; requires: string | null; owned: boolean; unlocked: boolean; current: boolean }
interface Info { fee: number; ready: boolean; options: Option[] }
const MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford the fee.", class_locked: "Train the first class before this one.", choose_class_first: "Choose a class at the guild first.",
  class_not_available: "That class isn't available.", already_has_class: "Already in that class.", sold_out: "That class is sold out right now.",
};

/** The class changer: move a fighter to another class of its role. Advanced classes need their first class. Gear comes off; rank and level stay. */
export function ClassChangerPanel() {
  const [fighters, setFighters] = useState<Fighter[] | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [f, p] = await Promise.all([
      sb.from("fighters").select("id, level, nickname, template:fighter_templates(name, archetype, rarity)").order("team_slot", { ascending: true, nullsFirst: false }),
      sb.from("profiles").select("coins").single(),
    ]);
    if (f.error) { setNote({ text: "Couldn't open the register. Try again.", bad: true }); return; }
    type Row = { id: string; level: number; nickname: string | null; template: { name: string; archetype: string; rarity: Rarity } | { name: string; archetype: string; rarity: Rarity }[] | null };
    setFighters(((f.data ?? []) as unknown as Row[]).flatMap((r) => { const t = Array.isArray(r.template) ? r.template[0] : r.template; return t ? [{ id: r.id, name: r.nickname ?? t.name, level: r.level, archetype: t.archetype, rarity: t.rarity }] : []; }));
    setCoins((p.data?.coins as number | undefined) ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setInfo(null); setPick(null);
    if (!sel) return;
    void createClient().rpc("class_changer", { p_fighter: sel }).then(({ data }) => setInfo((data as Info | null) ?? null));
  }, [sel, fighters]);

  const change = async () => {
    if (!sel || !pick || busy) return;
    setBusy(true); setNote(null);
    const { error } = await createClient().rpc("change_class", { p_fighter: sel, p_archetype: pick });
    setNote(error ? { text: MESSAGES[Object.keys(MESSAGES).find((k) => error.message.includes(k)) ?? ""] ?? "That didn't work. Try again.", bad: true } : { text: `Now a ${ARCHETYPE_LABEL[pick]}. Their gear is back in your bag.`, bad: false });
    setPick(null);
    await load();
    setBusy(false);
  };

  const cur = fighters?.find((f) => f.id === sel);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {coins !== null && <p className="text-lg text-gold">Coins {coins}</p>}
      {note && <p role="alert" className={`text-lg ${note.bad ? "text-ember" : "text-leaf"}`}>{note.text}</p>}
      {fighters === null ? <div className="h-24 animate-pulse bg-panel" aria-busy="true" /> : (
        <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {fighters.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setSel(f.id === sel ? null : f.id)} aria-pressed={f.id === sel} className={`pixel-btn w-full px-2 py-1 text-left text-lg ${f.id === sel ? "bg-gold text-ink" : "bg-panel text-paper"}`}>
                {f.name} <span className="text-base opacity-70">Lv {f.level} · {ARCHETYPE_LABEL[f.archetype] ?? f.archetype} · {RANK_LABEL[f.rarity]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && info && !info.ready && <p className="text-base text-steel">{cur.name} needs a class first: Novices become Recruits, and Recruits choose a class, from the fighter menu in the guild.</p>}
      {cur && info?.ready && (
        <div className="pixel-box space-y-1 bg-night p-2">
          <p className="text-base text-steel">Weapons and armour come off when the class changes. Rank and level stay. Fee {info.fee} coins.</p>
          {info.options.map((o) => {
            const disabled = o.current || !o.unlocked;
            return (
              <button key={o.archetype} type="button" disabled={disabled} onClick={() => setPick(o.archetype === pick ? null : o.archetype)} aria-pressed={pick === o.archetype}
                className={`pixel-btn flex w-full items-center justify-between px-2 py-1 text-left text-lg ${pick === o.archetype ? "bg-gold text-ink" : "bg-panel text-paper"} disabled:opacity-50`}>
                <span>{ARCHETYPE_LABEL[o.archetype] ?? o.archetype}{o.tier > 1 ? " ★" : ""}</span>
                <span className="text-base opacity-80">{o.current ? "Current" : !o.unlocked ? `Needs ${ARCHETYPE_LABEL[o.requires ?? ""] ?? o.requires}` : o.owned ? "Held before" : "Available"}</span>
              </button>
            );
          })}
          <PixelButton className="mt-1 w-full" disabled={!pick || busy || (coins ?? 0) < info.fee} onClick={change}>
            {pick ? `Become ${ARCHETYPE_LABEL[pick]} (${info.fee} coins)` : "Pick a class"}
          </PixelButton>
        </div>
      )}
    </div>
  );
}
