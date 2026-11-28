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

  return (
    <div className="space-y-3 text-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <PixelButton variant={tab === "look" ? "primary" : "ghost"} className="text-base" onClick={() => setTab("look")}>Guild look</PixelButton>
          <PixelButton variant={tab === "furniture" ? "primary" : "ghost"} className="text-base" onClick={() => setTab("furniture")}>Furniture</PixelButton>
        </div>
        <p className="text-gold">🪙 {coins ?? "..."}</p>
      </div>
      {note && <p role="status" className={note.bad ? "text-ember" : "text-leaf"}>{note.text}</p>}

      {tab === "look" ? (
        <div className="space-y-2">
          <p className="text-steel">Your guild is a <span className="text-paper">{RANK_NAME[rank]}</span>. A better hall costs coins, and you keep all your furniture.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[1, 2, 3, 4].map((r) => {
              const row = ranks.find((x) => x.rank === r);
              const isNow = r === rank, isNext = r === rank + 1;
              return (
                <div key={r} className={`pixel-box bg-panel p-2 ${isNow ? "outline outline-2 outline-gold" : ""}`}>
                  <div className="aspect-[2/1] w-full bg-night bg-cover bg-top" style={{ backgroundImage: `url(/guild/hall_r${r}.webp)` }} role="img" aria-label={RANK_NAME[r]} />
                  <p className="mt-1 uppercase text-gold">{RANK_NAME[r]}</p>
                  {isNow ? <p className="text-leaf">Your guild</p> : r < rank ? <p className="text-steel">Owned</p> : isNext && row ? (
                    <PixelButton className="mt-1 w-full text-base" disabled={busy || (coins ?? 0) < row.price} onClick={() => void run(() => createClient().rpc("guild_rank_up"), `Your guild is now a ${RANK_NAME[r]}.`)}>Build · 🪙 {row.price}</PixelButton>
                  ) : <p className="text-steel">Upgrade the one before first{row ? ` · 🪙 ${row.price}` : ""}</p>}
                </div>
              );
            })}
          </div>
          {!next && rank >= 4 && <p className="text-leaf">Nothing finer to build. Now decorate it!</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-steel">Buy furniture here, then tap Decorate in your guild to place it. You own {owns}/60.</p>
          <div className="grid max-h-[46dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {decor.map((d) => (
              <div key={d.slug} className="pixel-box flex flex-col items-center gap-1 bg-panel p-2 text-center">
                <div className="flex h-20 items-center justify-center"><img src={`/guild/props/${d.slug}.png`} alt="" draggable={false} className="max-h-20 max-w-full [image-rendering:pixelated]" /></div>
                <p className="leading-tight">{d.name}</p>
                <p className="text-sm text-steel">You have {owned[d.slug] ?? 0}</p>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Fewer" className="pixel-box h-7 w-7 bg-night" onClick={() => setQty({ ...qty, [d.slug]: Math.max(1, n(d.slug) - 1) })}>-</button>
                  <span className="w-6 text-center">{n(d.slug)}</span>
                  <button type="button" aria-label="More" className="pixel-box h-7 w-7 bg-night" onClick={() => setQty({ ...qty, [d.slug]: Math.min(20, n(d.slug) + 1) })}>+</button>
                </div>
                <PixelButton className="w-full text-sm" disabled={busy || (coins ?? 0) < d.price * n(d.slug)} onClick={() => void run(() => createClient().rpc("guild_buy_decor", { p_slug: d.slug, p_qty: n(d.slug) }), `Bought ${n(d.slug)} × ${d.name}.`)}>Buy · 🪙 {d.price * n(d.slug)}</PixelButton>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
