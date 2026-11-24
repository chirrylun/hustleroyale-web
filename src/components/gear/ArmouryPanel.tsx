"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/gear/GearIcon";
import { GearPreview } from "@/components/gear/GearPreview";
import { UiIcon } from "@/components/ui/UiIcon";
import { loadFighters, type GuildFighter } from "@/lib/guild";
import { MAX_LEVEL, RANK_TEXT, SLOT_LABEL, classLabel, gearError, genderOf, minLevel, rankName, sellPrice, statLine, whyNot, type GearBase, type GearItem, type GearSlot } from "@/lib/gear";
import { createClient } from "@/lib/supabase/client";

type Mode = "buy" | "sell";
const SLOTS: (GearSlot | "all")[] = ["all", "weapon", "offhand", "armor"];

/** The armoury: buy rank 1 weapons, shields and armour sets with coins, or sell spare pieces. Every rule (price, class, level) is the database's.
 *  Rank and level upgrades come from the enhancer. */
export function ArmouryPanel() {
  const [bases, setBases] = useState<GearBase[] | null>(null);
  const [items, setItems] = useState<GearItem[]>([]);
  const [wornIds, setWornIds] = useState<Set<string>>(new Set());
  const [fighters, setFighters] = useState<GuildFighter[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("buy");
  const [slot, setSlot] = useState<GearSlot | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ base: GearBase; rank: number; level: number } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setError("Please sign in again."); return; }
    const [t, inv, w, prof, fs] = await Promise.all([
      sb.from("equipment_bases").select("*").order("sort"),
      sb.from("gear_items").select("id, base_slug, rank, level, atk, def, magic, hp, spd").order("created_at"),
      sb.from("fighter_gear").select("item_id"),
      sb.from("profiles").select("coins").single(),
      loadFighters(sb, user.id),
    ]);
    if (t.error || inv.error || w.error || prof.error) { setError("Couldn't open the armoury. Try again."); return; }
    setBases((t.data ?? []) as GearBase[]);
    setItems((inv.data ?? []) as GearItem[]);
    setWornIds(new Set((w.data ?? []).map((r) => r.item_id as string)));
    setCoins(Number(prof.data?.coins));
    setFighters(fs);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const baseOf = useMemo(() => new Map((bases ?? []).map((b) => [b.slug, b])), [bases]);
  const ownedCount = (slug: string) => items.filter((i) => i.base_slug === slug).length;

  const run = async (fn: string, args: Record<string, string>) => {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc(fn, args);
    if (e) setError(gearError(e.message));
    await load();
    setBusy(false);
  };

  const buyRows = useMemo(() => (bases ?? []).filter((b) => slot === "all" || b.slot === slot), [bases, slot]);
  const sellRows = useMemo(() => items.filter((i) => !wornIds.has(i.id) && (slot === "all" || baseOf.get(i.base_slug)?.slot === slot)), [items, wornIds, slot, baseOf]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-xl text-paper">
        <span className="flex items-center gap-1"><UiIcon name="coins" size={24} /> {coins ?? "…"}</span>
        <span className="text-base text-steel">Equip gear from My Fighters</span>
      </div>
      <div className="flex gap-1" role="tablist">
        {(["buy", "sell"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 px-2 py-1 text-xl uppercase ${mode === m ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{m === "buy" ? "Buy" : "Sell"}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {SLOTS.map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} className={`px-2 py-0.5 text-base uppercase ${slot === s ? "bg-leaf text-ink" : "bg-panel text-paper"}`}>{s === "all" ? "All" : SLOT_LABEL[s]}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-lg text-ember">{error}</p>}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {bases === null ? <div className="h-32 animate-pulse bg-panel" aria-busy="true" />
          : mode === "buy" ? (buyRows.length === 0 ? <p className="text-xl text-paper">Nothing here.</p> : buyRows.map((b) => {
            const fits = fighters.filter((f) => !whyNot(b, 1, f));
            const can = !busy && (coins ?? 0) >= b.base_price;
            return (
              <div key={b.slug} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon base={b.slug} kind={b.kind} rank={1} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{b.name}{ownedCount(b.slug) > 0 && <span className="ml-1 text-base text-steel">×{ownedCount(b.slug)}</span>}</p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[1]}>{rankName(1)}</span> · Lv 1/{MAX_LEVEL} · {classLabel(b)}</p>
                  <p className="truncate text-base text-leaf">{statLine(b)}</p>
                  <p className={`truncate text-sm ${fits.length ? "text-leaf" : "text-ember"}`}>{fits.length ? `Fits ${fits.slice(0, 2).map((f) => f.template.name).join(", ")}${fits.length > 2 ? ` +${fits.length - 2}` : ""}` : "None of your fighters can wear this yet"}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={!can} onClick={() => run("gear_buy", { p_base: b.slug })} className="flex items-center justify-center gap-1 bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">Buy <span>{b.base_price}</span><UiIcon name="coins" size={18} /></button>
                  <button type="button" onClick={() => setView({ base: b, rank: 1, level: 1 })} className="bg-night px-3 py-0.5 text-base uppercase text-paper">View</button>
                </div>
              </div>
            );
          }))
          : sellRows.length === 0 ? <p className="text-xl text-paper">You have no spare gear to sell.</p>
          : sellRows.map((i) => {
            const b = baseOf.get(i.base_slug);
            if (!b) return null;
            const price = sellPrice(b, i.rank, i.level);
            return (
              <div key={i.id} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon base={b.slug} kind={b.kind} rank={i.rank} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{b.name}</p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[i.rank]}>{rankName(i.rank)}</span> · Lv {i.level}/{MAX_LEVEL} · wear at Lv {minLevel(i.rank)}+</p>
                  <p className="truncate text-base text-leaf">{statLine(i)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={busy} onClick={() => run("gear_sell", { p_item: i.id })} className="flex items-center justify-center gap-1 bg-gold px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">Sell <span>{price}</span><UiIcon name="coins" size={18} /></button>
                  <button type="button" onClick={() => setView({ base: b, rank: i.rank, level: i.level })} className="bg-night px-3 py-0.5 text-base uppercase text-paper">View</button>
                </div>
              </div>
            );
          })}
      </div>
      {view && <GearPreview base={view.base} rank={view.rank} level={view.level} gender={genderOf(fighters[0])} onClose={() => setView(null)} />}
    </div>
  );
}
