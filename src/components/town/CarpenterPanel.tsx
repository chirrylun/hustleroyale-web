/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { createClient } from "@/lib/supabase/client";
import { RANK_NAME } from "@/lib/guild-ranks";

interface RankRow { rank: number; name: string; price: number }
interface DecorRow { slug: string; name: string; price: number }
const MESSAGES: Record<string, string> = {
  not_enough_coins: "You can't afford that.", max_rank: "Your guild is already the finest in the land.", guild_full: "Your guild can't hold more than 60 pieces.",
  bad_quantity: "Pick between 1 and 20.", unauthorized: "Please sign in again.",
};

/** The carpenter: pays for a new look for the guild hall (one rank at a time) and sells furniture to put in it. Prices and sums are the server's. */
export function CarpenterPanel() {
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [decor, setDecor] = useState<DecorRow[]>([]);
  const [rank, setRank] = useState(1);
  const [coins, setCoins] = useState<number | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"look" | "furniture">("look");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [r, d, prof, mine] = await Promise.all([
      sb.from("guild_rank_prices").select("rank, name, price").order("rank"),
      sb.from("guild_decor_catalog").select("slug, name, price").order("sort"),
      sb.from("profiles").select("coins, guild_rank").single(),
      sb.from("guild_decor").select("slug"),
    ]);
    setRanks((r.data ?? []) as RankRow[]);
    setDecor((d.data ?? []) as DecorRow[]);
    setCoins((prof.data?.coins as number) ?? 0);
    setRank((prof.data?.guild_rank as number) ?? 1);
    const o: Record<string, number> = {};
    for (const x of mine.data ?? []) o[x.slug as string] = (o[x.slug as string] ?? 0) + 1;
    setOwned(o);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, ok: string) => {
    setBusy(true); setNote(null);
    const { data, error } = await fn();
    setBusy(false);
    if (error) { setNote({ text: MESSAGES[Object.keys(MESSAGES).find((k) => error.message.includes(k)) ?? ""] ?? "That didn't work.", bad: true }); return; }
    const c = (data as { coins?: number } | null)?.coins;
    if (typeof c === "number") setCoins(c);
    setNote({ text: ok, bad: false });
    void load();
  };

  const next = ranks.find((r) => r.rank === rank + 1);
  const n = (slug: string) => qty[slug] ?? 1;
  const owns = Object.values(owned).reduce((a, b) => a + b, 0);

  const tabBtn = (t: "look" | "furniture", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`pixel-box min-h-11 flex-1 px-3 text-lg uppercase ${tab === t ? "bg-gold text-ink" : "bg-panel text-paper"}`}
    >{label}</button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 text-lg short:text-base">
      <div className="flex shrink-0 items-stretch gap-2">
        <div role="tablist" className="flex flex-1 gap-1.5">{tabBtn("look", "Guild look")}{tabBtn("furniture", "Furniture")}</div>
        <p className="pixel-box flex shrink-0 items-center bg-panel px-3 text-gold" aria-label="Your coins">🪙 {coins ?? "..."}</p>
      </div>
      <p role="status" className={`min-h-6 shrink-0 ${note ? (note.bad ? "text-ember" : "text-leaf") : "text-steel"}`}>
        {note?.text ?? (tab === "look" ? `Your guild is a ${RANK_NAME[rank]}. Upgrades keep all your furniture.` : `Buy here, then tap Decorate in your guild to place it. You own ${owns} of 60.`)}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "look" ? (
          <ul className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((r) => {
              const row = ranks.find((x) => x.rank === r);
              const isNow = r === rank, isNext = r === rank + 1, done = r < rank;
              return (
                <li key={r} className={`pixel-box flex gap-3 bg-panel p-2 ${isNow ? "outline outline-2 outline-gold" : ""} ${!isNow && !isNext && !done ? "opacity-70" : ""}`}>
                  <div className="aspect-square w-24 shrink-0 bg-night bg-cover bg-top sm:w-32" style={{ backgroundImage: `url(/guild/hall_r${r}.webp)` }} role="img" aria-label={`${RANK_NAME[r]} preview`} />
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
                    <div>
                      <p className="truncate uppercase text-gold">{r}. {RANK_NAME[r]}</p>
                      <p className="text-steel">{isNow ? "Your guild today" : done ? "Built" : isNext ? "The next upgrade" : "Build the one before first"}</p>
                    </div>
                    {isNext && row ? (
                      <PixelButton className="w-full text-base" disabled={busy || (coins ?? 0) < row.price} onClick={() => void run(() => createClient().rpc("guild_rank_up"), `Your guild is now a ${RANK_NAME[r]}.`)}>
                        {(coins ?? 0) < row.price ? `Need 🪙 ${row.price - (coins ?? 0)} more` : `Build · 🪙 ${row.price}`}
                      </PixelButton>
                    ) : isNow ? <p className="text-leaf">✔ Current look</p> : !done && row ? <p className="text-steel">🪙 {row.price}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
            {decor.map((d) => {
              const total = d.price * n(d.slug), poor = (coins ?? 0) < total;
              return (
                <li key={d.slug} className="pixel-box flex flex-col gap-1 bg-panel p-2">
                  <div className="flex h-20 items-center justify-center bg-night"><img src={`/guild/props/${d.slug}.png`} alt="" draggable={false} className="max-h-14 max-w-[70%] [image-rendering:pixelated]" /></div>
                  <p className="truncate leading-tight">{d.name}</p>
                  <p className="text-sm text-steel">🪙 {d.price} each · you have {owned[d.slug] ?? 0}</p>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <button type="button" aria-label={`Fewer ${d.name}`} className="pixel-box h-9 w-9 shrink-0 bg-night text-xl" onClick={() => setQty({ ...qty, [d.slug]: Math.max(1, n(d.slug) - 1) })}>-</button>
                    <span className="min-w-6 text-center">{n(d.slug)}</span>
                    <button type="button" aria-label={`More ${d.name}`} className="pixel-box h-9 w-9 shrink-0 bg-night text-xl" onClick={() => setQty({ ...qty, [d.slug]: Math.min(20, n(d.slug) + 1) })}>+</button>
                  </div>
                  <PixelButton className="w-full px-2 text-base" disabled={busy || poor} onClick={() => void run(() => createClient().rpc("guild_buy_decor", { p_slug: d.slug, p_qty: n(d.slug) }), `Bought ${n(d.slug)} × ${d.name}.`)}>Buy · 🪙 {total}</PixelButton>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
