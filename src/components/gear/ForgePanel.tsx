"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/gear/GearIcon";
import { UiIcon } from "@/components/ui/UiIcon";
import { EVOLVE_MIN_LEVEL, MAX_LEVEL, RANK_TEXT, SLOT_LABEL, enhanceCost, evolveCost, gearError, maxRankOf, rankName, statLine, statsAt, type GearBase, type GearItem, type GearSlot } from "@/lib/gear";
import { createClient } from "@/lib/supabase/client";

const SLOTS: (GearSlot | "all")[] = ["all", "weapon", "offhand", "armor"];
type Row = GearItem & { worn: boolean };

/** The blacksmith: raise a piece's level with coins (enhance), and at level 10 turn it into the next rank (evolve, opens when a fighter reaches level 40).
 *  Prices and every rule are the database's (gear_enhance, gear_evolve); this only shows them. */
export function ForgePanel() {
  const [bases, setBases] = useState<Map<string, GearBase> | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [slot, setSlot] = useState<GearSlot | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, inv, w, prof, fs] = await Promise.all([
      sb.from("equipment_bases").select("*").order("sort"),
      sb.from("gear_items").select("id, base_slug, rank, level, atk, def, magic, hp, spd").order("created_at"),
      sb.from("fighter_gear").select("item_id"),
      sb.from("profiles").select("coins").single(),
      sb.from("fighters").select("level"),
    ]);
    if (t.error || inv.error || w.error || prof.error || fs.error) { setError("Couldn't open the forge. Try again."); return; }
    const worn = new Set((w.data ?? []).map((r) => r.item_id as string));
    setBases(new Map(((t.data ?? []) as GearBase[]).map((b) => [b.slug, b])));
    setItems(((inv.data ?? []) as GearItem[]).map((i) => ({ ...i, worn: worn.has(i.id) })));
    setCoins(Number(prof.data?.coins));
    setBest(Math.max(0, ...(fs.data ?? []).map((r) => r.level as number)));
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const act = async (fn: "gear_enhance" | "gear_evolve", item: Row, b: GearBase) => {
    if (busy) return;
    setBusy(true); setError(null); setNote(null);
    const { error: e } = await createClient().rpc(fn, { p_item: item.id });
    if (e) setError(e.message.includes("evolve_locked") ? `Evolving opens when one of your fighters reaches level ${EVOLVE_MIN_LEVEL}.` : e.message.includes("level_too_low") ? "The fighter wearing it is too low a level for the next rank." : gearError(e.message));
    else setNote(fn === "gear_enhance" ? `${b.name} is now level ${item.level + 1}.` : `${b.name} evolved to ${rankName(item.rank + 1)}!`);
    await load();
    setBusy(false);
  };

  const rows = useMemo(() => items.filter((i) => slot === "all" || bases?.get(i.base_slug)?.slot === slot), [items, slot, bases]);
  const unlocked = best >= EVOLVE_MIN_LEVEL;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-xl text-paper">
        <span className="flex items-center gap-1"><UiIcon name="coins" size={24} /> {coins ?? "…"}</span>
        <span className="text-base text-steel">Enhance to level {MAX_LEVEL}, then evolve</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {SLOTS.map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} className={`px-2 py-0.5 text-base uppercase ${slot === s ? "bg-leaf text-ink" : "bg-panel text-paper"}`}>{s === "all" ? "All" : SLOT_LABEL[s]}</button>
        ))}
      </div>
      {!unlocked && bases && <p className="text-base text-steel">Evolving opens when one of your fighters reaches level {EVOLVE_MIN_LEVEL}. Until then, enhance.</p>}
      {note && <p role="status" className="text-lg text-gold">{note}</p>}
      {error && <p role="alert" className="text-lg text-ember">{error}</p>}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {bases === null ? <div className="h-32 animate-pulse bg-panel" aria-busy="true" />
          : rows.length === 0 ? <p className="text-xl text-paper">You have no gear to work on. The Armourer sells it.</p>
          : rows.map((i) => {
            const b = bases.get(i.base_slug);
            if (!b) return null;
            const top = maxRankOf(b);
            const maxed = i.level >= MAX_LEVEL;
            const cost = enhanceCost(b, i.rank, i.level);
            const next = statsAt(b, i.rank, i.level + 1);
            return (
              <div key={i.id} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon base={b.slug} kind={b.kind} rank={i.rank} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{b.name}{i.worn && <span className="ml-1 text-base text-steel">worn</span>}</p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[i.rank]}>{rankName(i.rank)}</span> · Lv {i.level}/{MAX_LEVEL}</p>
                  <p className="truncate text-base text-leaf">{statLine(i)}</p>
                  {!maxed && <p className="truncate text-sm text-steel">Next: {statLine(next)}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!maxed
                    ? <button type="button" disabled={busy || (coins ?? 0) < cost} onClick={() => act("gear_enhance", i, b)} className="flex items-center justify-center gap-1 bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">Enhance <span>{cost}</span><UiIcon name="coins" size={18} /></button>
                    : i.rank >= top
                      ? <span className="px-3 py-1 text-center text-base uppercase text-gold">Fully evolved</span>
                      : <button type="button" disabled={busy || !unlocked || (coins ?? 0) < evolveCost(b, i.rank)} onClick={() => act("gear_evolve", i, b)} className="flex items-center justify-center gap-1 bg-gold px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">{unlocked ? <>Evolve <span>{evolveCost(b, i.rank)}</span><UiIcon name="coins" size={18} /></> : `Evolve · Lv ${EVOLVE_MIN_LEVEL}`}</button>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
