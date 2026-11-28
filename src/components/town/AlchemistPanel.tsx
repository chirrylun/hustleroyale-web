/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { BAG_MAX } from "@/components/floor/BagMenu";
import { UiIcon } from "@/components/ui/UiIcon";
import { itemImage, itemName } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";

interface Recipe { slug: string; output: string; qty: number; coins: number; inputs: { item: string; qty: number }[] }
type Mode = "mix" | "sell";
const MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford the fee.", bag_full: `Your bag is full (${BAG_MAX} items).`, not_enough_items: "You're missing some parts.",
  not_for_sale: "She has no use for that.", unauthorized: "Please sign in again.",
};

/** The alchemist: turns monster parts into potions (the recipes and sums are the server's) and buys parts for coins. */
export function AlchemistPanel() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("mix");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [r, i, p, inv, prof] = await Promise.all([
      sb.from("alchemy_recipes").select("slug, output_slug, out_qty, coins").order("sort"),
      sb.from("alchemy_inputs").select("recipe, item_slug, qty"),
      sb.from("alchemy_prices").select("item_slug, sell_price"),
      sb.from("player_items").select("item_slug, qty"),
      sb.from("profiles").select("coins").single(),
    ]);
    if (r.error || i.error || p.error || inv.error || prof.error) { setNote({ text: "Couldn't open the workshop. Try again.", bad: true }); return; }
    setRecipes((r.data ?? []).map((x) => ({ slug: x.slug as string, output: x.output_slug as string, qty: x.out_qty as number, coins: x.coins as number,
      inputs: (i.data ?? []).filter((n) => n.recipe === x.slug).map((n) => ({ item: n.item_slug as string, qty: n.qty as number })) })));
    setPrices(Object.fromEntries((p.data ?? []).map((x) => [x.item_slug as string, x.sell_price as number])));
    setOwned(Object.fromEntries((inv.data ?? []).map((x) => [x.item_slug as string, x.qty as number])));
    setCoins(prof.data?.coins as number);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    if (busy) return;
    setBusy(true); setNote(null);
    const { error } = await createClient().rpc(fn, args);
    setNote(error ? { text: MESSAGES[Object.keys(MESSAGES).find((k) => error.message.includes(k)) ?? ""] ?? "That didn't work. Try again.", bad: true } : { text: ok, bad: false });
    await load();
    setBusy(false);
  };

  const carried = Object.values(owned).reduce((s, n) => s + n, 0);
  const sellable = Object.keys(prices).filter((s) => (owned[s] ?? 0) > 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 text-xl text-paper">
        <span className="pixel-box flex min-h-11 items-center gap-1 bg-panel px-3 text-gold"><UiIcon name="coins" size={24} /> {coins ?? "…"}</span>
        <span className="pixel-box flex min-h-11 items-center bg-panel px-3 text-base text-steel">Bag {carried}/{BAG_MAX}</span>
      </div>
      <div className="flex shrink-0 gap-1.5" role="tablist">
        {(["mix", "sell"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`pixel-box min-h-11 flex-1 px-2 text-xl uppercase ${mode === m ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{m === "mix" ? "Mix potions" : "Sell parts"}</button>
        ))}
      </div>
      {note && <p role="alert" className={`shrink-0 text-lg ${note.bad ? "text-ember" : "text-leaf"}`}>{note.text}</p>}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {recipes === null ? <div className="h-32 animate-pulse bg-panel" aria-busy="true" />
          : mode === "mix" ? recipes.map((r) => {
            const times = Math.min(...r.inputs.map((n) => Math.floor((owned[n.item] ?? 0) / n.qty)), r.coins > 0 ? Math.floor((coins ?? 0) / r.coins) : 99);
            const can = !busy && times >= 1;
            return (
              <div key={r.slug} className="pixel-box flex flex-wrap items-center gap-2 bg-panel p-2">
                <img src={itemImage(r.output)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 [image-rendering:pixelated]" draggable={false} />
                <div className="min-w-0 flex-1 basis-40 leading-tight">
                  <p className="truncate text-xl text-paper">{itemName(r.output)}{(owned[r.output] ?? 0) > 0 && <span className="ml-1 text-base text-gold">You have {owned[r.output]}</span>}</p>
                  <p className="text-base text-steel">
                    {r.inputs.map((n, k) => (
                      <span key={n.item} className={(owned[n.item] ?? 0) >= n.qty ? "text-leaf" : "text-ember"}>{k ? " + " : ""}{n.qty} {itemName(n.item)}</span>
                    ))}
                    {r.coins > 0 && <span> · {r.coins} coins</span>}
                  </p>
                </div>
                <button type="button" disabled={!can} onClick={() => run("alchemist_mix", { p_recipe: r.slug, p_times: 1 }, `Mixed ${itemName(r.output)}.`)} className="ml-auto min-h-10 shrink-0 bg-leaf px-4 py-1 text-xl uppercase text-ink disabled:opacity-40">Mix</button>
                {times > 1 && <button type="button" disabled={busy} onClick={() => run("alchemist_mix", { p_recipe: r.slug, p_times: Math.min(times, 20) }, `Mixed ${Math.min(times, 20)} ${itemName(r.output)}.`)} className="min-h-10 shrink-0 bg-night px-3 py-1 text-base uppercase text-gold disabled:opacity-40">×{Math.min(times, 20)}</button>}
              </div>
            );
          })
          : sellable.length === 0 ? <p className="text-xl text-paper">You have no monster parts to sell.</p>
          : sellable.map((s) => (
            <div key={s} className="pixel-box flex flex-wrap items-center gap-2 bg-panel p-2">
              <img src={itemImage(s)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 [image-rendering:pixelated]" draggable={false} />
              <p className="min-w-0 flex-1 basis-32 truncate text-xl text-paper">{itemName(s)} <span className="text-base text-gold">You have {owned[s]}</span></p>
              <button type="button" disabled={busy} onClick={() => run("alchemist_sell", { p_slug: s, p_qty: 1 }, `Sold ${itemName(s)}.`)} className="ml-auto flex min-h-10 shrink-0 items-center gap-1 bg-gold px-4 py-1 text-xl uppercase text-ink disabled:opacity-40">Sell <span>{prices[s]}</span><UiIcon name="coins" size={18} /></button>
              {owned[s] > 1 && <button type="button" disabled={busy} onClick={() => run("alchemist_sell", { p_slug: s, p_qty: Math.min(99, owned[s]) }, `Sold ${Math.min(99, owned[s])} ${itemName(s)}.`)} className="min-h-10 shrink-0 bg-night px-3 py-1 text-base uppercase text-gold disabled:opacity-40">All</button>}
            </div>
          ))}
      </div>
    </div>
  );
}
