/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { BAG_MAX } from "@/components/floor/BagMenu";
import { UiIcon } from "@/components/ui/UiIcon";
import { POTIONS, itemImage, itemName } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";

interface Good { slug: string; buy: number; sell: number }
type Mode = "buy" | "sell";

const MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford that.", bag_full: `Your bag is full (${BAG_MAX} items).`, not_enough_items: "You don't have that many.",
  not_for_sale: "The merchant doesn't deal in that.", unauthorized: "Please sign in again.",
};
const EFFECT = (slug: string) => {
  const p = POTIONS[slug];
  if (!p) return "";
  return p.kind === "revive" ? "Revives a fallen fighter at half health" : `Restores ${Math.round(p.frac * 100)}% of ${p.kind === "hp" ? "health" : "mana"}`;
};

/** The marketplace: buy potions with coins, or sell the ones you carry. Prices and the sums are the server's. */
export function MarketPanel() {
  const [goods, setGoods] = useState<Good[] | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("buy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const sb = createClient();
    const [g, inv, prof] = await Promise.all([
      sb.from("market_goods").select("slug, buy_price, sell_price").order("sort"),
      sb.from("player_items").select("item_slug, qty"),
      sb.from("profiles").select("coins").single(),
    ]);
    if (g.error || inv.error || prof.error) { setError("Couldn't open the stalls. Try again."); return; }
    setGoods((g.data ?? []).map((r) => ({ slug: r.slug as string, buy: r.buy_price as number, sell: r.sell_price as number })));
    setOwned(Object.fromEntries((inv.data ?? []).map((r) => [r.item_slug as string, r.qty as number])));
    setCoins(prof.data?.coins as number);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const deal = async (slug: string, qty: number) => {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc(mode === "buy" ? "market_buy" : "market_sell", { p_slug: slug, p_qty: qty });
    if (e) setError(MESSAGES[Object.keys(MESSAGES).find((k) => e.message.includes(k)) ?? ""] ?? "That didn't work. Try again.");
    await load();
    setBusy(false);
  };

  const carried = Object.values(owned).reduce((s, n) => s + n, 0);
  const rows = (goods ?? []).filter((g) => mode === "buy" || (owned[g.slug] ?? 0) > 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-xl text-paper">
        <span className="flex items-center gap-1"><UiIcon name="coins" size={24} /> {coins ?? "…"}</span>
        <span className="text-base text-steel">Bag {carried}/{BAG_MAX}</span>
      </div>
      <div className="flex gap-1" role="tablist">
        {(["buy", "sell"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 px-2 py-1 text-xl uppercase ${mode === m ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{m === "buy" ? "Buy" : "Sell"}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-lg text-ember">{error}</p>}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {goods === null ? <div className="h-32 animate-pulse bg-panel" aria-busy="true" />
          : rows.length === 0 ? <p className="text-xl text-paper">You have nothing the merchant wants.</p>
          : rows.map((g) => {
            const have = owned[g.slug] ?? 0;
            const price = mode === "buy" ? g.buy : g.sell;
            // How many can be dealt at once: what you can afford and fit in the bag, or what you carry (the server allows 99 a time).
            const most = Math.max(0, Math.min(99, mode === "buy" ? Math.min(Math.floor((coins ?? 0) / price), BAG_MAX - carried) : have));
            const n = Math.min(Math.max(1, qty[g.slug] ?? 1), Math.max(1, most));
            const can = !busy && most >= 1;
            const set = (v: number) => setQty((q) => ({ ...q, [g.slug]: Math.min(Math.max(1, v), Math.max(1, most)) }));
            return (
              <div key={g.slug} className="pixel-box flex flex-wrap items-center gap-x-2 gap-y-1 bg-panel p-1.5">
                <img src={itemImage(g.slug)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 [image-rendering:pixelated]" draggable={false} />
                <div className="min-w-0 flex-1 basis-32 leading-tight">
                  <p className="truncate text-xl text-paper">{itemName(g.slug)}</p>
                  <p className="truncate text-base text-steel">{EFFECT(g.slug)}</p>
                  <p className="text-base text-gold">You have {have}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Fewer" disabled={!can || n <= 1} onClick={() => set(n - 1)} className="h-8 w-8 bg-night text-xl text-paper disabled:opacity-40">−</button>
                  <input aria-label={`Amount of ${itemName(g.slug)}`} inputMode="numeric" value={n} disabled={!can}
                    onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ""), 10) || 1)} className="h-8 w-12 bg-night text-center text-xl text-paper" />
                  <button type="button" aria-label="More" disabled={!can || n >= most} onClick={() => set(n + 1)} className="h-8 w-8 bg-night text-xl text-paper disabled:opacity-40">+</button>
                  <button type="button" disabled={!can || n >= most} onClick={() => set(most)} className="h-8 bg-night px-2 text-base uppercase text-gold disabled:opacity-40">Max</button>
                </div>
                <button type="button" disabled={!can} onClick={() => { void deal(g.slug, n).then(() => setQty((q) => ({ ...q, [g.slug]: 1 }))); }} className={`flex shrink-0 items-center gap-1 px-3 py-1 text-xl uppercase text-ink disabled:opacity-40 ${mode === "buy" ? "bg-leaf" : "bg-gold"}`}>
                  {mode === "buy" ? "Buy" : "Sell"} {n > 1 ? `×${n}` : ""} <span>{price * n}</span><UiIcon name="coins" size={18} />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
