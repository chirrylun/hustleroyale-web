/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { RARITY, itemImage, itemName } from "@/lib/items";
import { BAG_MAX } from "@/components/floor/BagMenu";
import { createClient } from "@/lib/supabase/client";

interface Item { slug: string; name: string; rarity: string; qty: number }
type Side = "bag" | "box";

const MESSAGES: Record<string, string> = { bad_quantity: "That is too many at once.", storage_full: "The box is full.", bag_full: "Your bag is full (100 items).", not_enough_items: "You don't have that many.", unauthorized: "Please sign in again." };

/** The storage box: move items between your bag and a roomy box. Capacity is the total number of items inside. */
export function StoragePanel() {
  const [bag, setBag] = useState<Item[] | null>(null);
  const [box, setBox] = useState<Item[] | null>(null);
  const [cap, setCap] = useState(100);
  const [side, setSide] = useState<Side>("bag");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [num, setNum] = useState(1);

  const load = useCallback(async () => {
    const sb = createClient();
    const [tpl, inv, stored, prof] = await Promise.all([
      sb.from("item_templates").select("slug, name, rarity"),
      sb.from("player_items").select("item_slug, qty"),
      sb.from("item_storage").select("item_slug, qty"),
      sb.from("profiles").select("storage_cap").single(),
    ]);
    if (tpl.error || inv.error || stored.error) { setError("Couldn't open the box. Try again."); return; }
    const info = new Map((tpl.data ?? []).map((t) => [t.slug as string, t as { name: string; rarity: string }]));
    const shape = (rows: { item_slug: string; qty: number }[] | null): Item[] =>
      (rows ?? []).filter((r) => r.qty > 0).map((r) => ({ slug: r.item_slug, name: info.get(r.item_slug)?.name ?? itemName(r.item_slug), rarity: info.get(r.item_slug)?.rarity ?? "common", qty: r.qty }))
        .sort((a, b) => Object.keys(RARITY).indexOf(b.rarity) - Object.keys(RARITY).indexOf(a.rarity) || a.name.localeCompare(b.name));
    setBag(shape(inv.data)); setBox(shape(stored.data));
    if (prof.data?.storage_cap) setCap(prof.data.storage_cap as number);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const move = async (slug: string, qty: number) => {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("storage_move", { p_slug: slug, p_qty: qty });
    if (e) setError(MESSAGES[Object.keys(MESSAGES).find((k) => e.message.includes(k)) ?? ""] ?? "That didn't work. Try again.");
    await load();
    setBusy(false);
  };

  const used = box?.reduce((s, i) => s + i.qty, 0) ?? 0;
  const carried = bag?.reduce((s, i) => s + i.qty, 0) ?? 0;
  const room = Math.max(0, BAG_MAX - carried);
  const list = side === "bag" ? bag : box;
  const cur = list?.find((i) => i.slug === sel) ?? null;
  // The most that can move: what you have, limited by the room on the other side.
  const most = cur ? Math.max(0, Math.min(cur.qty, side === "bag" ? cap - used : room)) : 0;
  const n = Math.min(Math.max(1, num), Math.max(1, most));
  const pick = (slug: string) => { setSel(sel === slug ? null : slug); setNum(1); };
  const switchSide = (x: Side) => { setSide(x); setSel(null); setNum(1); };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-3 flex-1 bg-ink/80" role="progressbar" aria-label="Box space used" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used}>
          <div className={`h-full ${used >= cap ? "bg-ember" : "bg-gold"}`} style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
        </div>
        <span className="text-lg text-paper">Box {used}/{cap}</span>
      </div>
      <div className="flex gap-1" role="tablist">
        {(["bag", "box"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => switchSide(s)} className={`flex-1 px-2 py-1 text-xl uppercase ${side === s ? "bg-gold text-ink" : "bg-panel text-paper"}`}>
            {s === "bag" ? "Your bag" : "Storage box"}
          </button>
        ))}
      </div>
      <p className="text-base text-steel">{side === "bag" ? `Tap an item, then choose how many. Bag ${carried}/${BAG_MAX}.` : `Tap an item, then choose how many. Bag ${carried}/${BAG_MAX}${room === 0 ? " · full" : ""}.`}</p>
      <div className="max-h-72 min-h-32 overflow-y-auto">
        {list === null ? <div className="h-28 animate-pulse bg-panel" aria-busy="true" />
          : list.length === 0 ? <p className="py-6 text-center text-xl text-steel">{side === "bag" ? "Your bag is empty." : "The box is empty."}</p>
          : (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-4">
              {list.map((i) => (
                <li key={i.slug} className="flex min-w-0 flex-col items-center gap-1">
                  <button
                    type="button" aria-pressed={sel === i.slug} onClick={() => pick(i.slug)}
                    aria-label={i.name}
                    className={`relative flex aspect-square w-full items-center justify-center border-2 bg-panel enabled:hover:brightness-125 disabled:opacity-50 ${RARITY[i.rarity]?.ring ?? "border-steel"} ${sel === i.slug ? "outline outline-4 outline-gold" : ""}`}
                  >
                    <img src={itemImage(i.slug)} alt="" width={44} height={44} draggable={false} />
                    <span className="absolute bottom-0 right-0 bg-ink/80 px-1 text-lg leading-5 text-paper">{i.qty}</span>
                  </button>
                  <span className={`w-full truncate text-center text-sm leading-4 ${RARITY[i.rarity]?.text ?? "text-paper"}`}>{i.name}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      {cur && (
        <div className="pixel-box flex flex-wrap items-center gap-2 bg-panel p-2">
          <p className="min-w-0 flex-1 basis-28 truncate text-xl text-paper">{cur.name}</p>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Fewer" disabled={busy || n <= 1} onClick={() => setNum(n - 1)} className="h-10 w-10 bg-night text-xl text-paper disabled:opacity-40">−</button>
            <span className="min-w-8 text-center text-xl text-paper">{n}</span>
            <button type="button" aria-label="More" disabled={busy || n >= most} onClick={() => setNum(n + 1)} className="h-10 w-10 bg-night text-xl text-paper disabled:opacity-40">+</button>
            <button type="button" disabled={busy || n >= most} onClick={() => setNum(most)} className="h-10 bg-night px-3 text-base uppercase text-gold disabled:opacity-40">All</button>
          </div>
          <button type="button" disabled={busy || most < 1} onClick={() => move(cur.slug, (side === "bag" ? 1 : -1) * n).then(() => setNum(1))} className="min-h-10 w-full bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">
            {most < 1 ? (side === "bag" ? "The box is full" : "Your bag is full") : `${side === "bag" ? "Store" : "Take"} ${n}`}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xl text-ember">{error}</p>}
    </div>
  );
}
