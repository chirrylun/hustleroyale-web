"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/gear/GearIcon";
import { GearPreview } from "@/components/gear/GearPreview";
import { UiIcon } from "@/components/ui/UiIcon";
import { loadFighters, type GuildFighter } from "@/lib/guild";
import { RANK_NAME, RANK_TEXT, SLOT_LABEL, classLabel, gearError, genderOf, statLine, whyNot, type GearItem, type GearSlot } from "@/lib/gear";
import { createClient } from "@/lib/supabase/client";

type Mode = "buy" | "sell";
const SLOTS: (GearSlot | "all")[] = ["all", "weapon", "offhand", "armor"];

/** The armoury: buy weapons, shields and armour sets with coins, or sell spares. Every rule (price, class, level) is the database's. */
export function ArmouryPanel() {
  const [items, setItems] = useState<GearItem[] | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [worn, setWorn] = useState<Record<string, number>>({});
  const [fighters, setFighters] = useState<GuildFighter[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("buy");
  const [slot, setSlot] = useState<GearSlot | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<GearItem | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setError("Please sign in again."); return; }
    const [t, inv, w, prof, fs] = await Promise.all([
      sb.from("equipment_templates").select("*").order("sort"),
      sb.from("player_gear").select("item_slug, qty"),
      sb.from("fighter_gear").select("item_slug"),
      sb.from("profiles").select("coins").single(),
      loadFighters(sb, user.id),
    ]);
    if (t.error || inv.error || w.error || prof.error) { setError("Couldn't open the armoury. Try again."); return; }
    setItems((t.data ?? []) as GearItem[]);
    setOwned(Object.fromEntries((inv.data ?? []).map((r) => [r.item_slug as string, r.qty as number])));
    const wc: Record<string, number> = {};
    for (const r of w.data ?? []) wc[r.item_slug as string] = (wc[r.item_slug as string] ?? 0) + 1;
    setWorn(wc);
    setCoins(Number(prof.data?.coins));
    setFighters(fs);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const deal = async (it: GearItem) => {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc(mode === "buy" ? "gear_buy" : "gear_sell", { p_slug: it.slug });
    if (e) setError(gearError(e.message));
    await load();
    setBusy(false);
  };

  const rows = useMemo(() => (items ?? []).filter((i) => (slot === "all" || i.slot === slot) && (mode === "buy" || (owned[i.slug] ?? 0) - (worn[i.slug] ?? 0) > 0)), [items, slot, mode, owned, worn]);

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
        {items === null ? <div className="h-32 animate-pulse bg-panel" aria-busy="true" />
          : rows.length === 0 ? <p className="text-xl text-paper">{mode === "sell" ? "You have no spare gear to sell." : "Nothing here."}</p>
          : rows.map((i) => {
            const spare = (owned[i.slug] ?? 0) - (worn[i.slug] ?? 0);
            const price = mode === "buy" ? i.buy_price : i.sell_price;
            const can = !busy && (mode === "buy" ? (coins ?? 0) >= price : spare > 0);
            const fits = fighters.filter((f) => !whyNot(i, f));
            return (
              <div key={i.slug} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon slug={i.slug} kind={i.kind} rank={i.rank} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{i.name}{(owned[i.slug] ?? 0) > 0 && <span className="ml-1 text-base text-steel">×{owned[i.slug]}</span>}</p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[i.rank]}>{RANK_NAME[i.rank]}</span> · Lv {i.min_level}+ · {classLabel(i)}</p>
                  <p className="truncate text-base text-leaf">{statLine(i)}</p>
                  {mode === "buy" && <p className={`truncate text-sm ${fits.length ? "text-leaf" : "text-ember"}`}>{fits.length ? `Fits ${fits.slice(0, 2).map((f) => f.template.name).join(", ")}${fits.length > 2 ? ` +${fits.length - 2}` : ""}` : "None of your fighters can wear this yet"}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={!can} onClick={() => deal(i)} className={`flex items-center justify-center gap-1 px-3 py-1 text-xl uppercase text-ink disabled:opacity-40 ${mode === "buy" ? "bg-leaf" : "bg-gold"}`}>
                    {mode === "buy" ? "Buy" : "Sell"} <span>{price}</span><UiIcon name="coins" size={18} />
                  </button>
                  <button type="button" onClick={() => setView(i)} className="bg-night px-3 py-0.5 text-base uppercase text-paper">Preview</button>
                </div>
              </div>
            );
          })}
      </div>
      {view && <GearPreview item={view} gender={genderOf(fighters[0])} onClose={() => setView(null)} />}
    </div>
  );
}
