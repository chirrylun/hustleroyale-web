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
            const can = !busy && (mode === "buy" ? (coins ?? 0) >= price && carried < BAG_MAX : have > 0);
            return (
              <div key={g.slug} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <img src={itemImage(g.slug)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 [image-rendering:pixelated]" draggable={false} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{itemName(g.slug)}{have > 0 && <span className="ml-1 text-base text-steel">×{have}</span>}</p>
                  <p className="truncate text-base text-steel">{EFFECT(g.slug)}</p>
                </div>
                <button type="button" disabled={!can} onClick={() => deal(g.slug, 1)} className={`flex shrink-0 items-center gap-1 px-3 py-1 text-xl uppercase text-ink disabled:opacity-40 ${mode === "buy" ? "bg-leaf" : "bg-gold"}`}>
                  {mode === "buy" ? "Buy" : "Sell"} <span>{price}</span><UiIcon name="coins" size={18} />
                </button>
                {mode === "sell" && have > 1 && (
                  <button type="button" disabled={busy} onClick={() => deal(g.slug, have)} className="shrink-0 bg-night px-2 py-1 text-base uppercase text-gold disabled:opacity-40">All</button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
