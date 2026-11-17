/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon } from "@/components/ui/UiIcon";
import { POTION_SLUGS, RARITY, itemImage } from "@/lib/items";

interface Item { slug: string; name: string; rarity: string; qty: number; blurb: string }

export const BAG_MAX = 100;
const USABLE = POTION_SLUGS;
type Ask = { kind: "use" | "discard"; n: number };
interface Obj { idx: number; text: string; have: number; need: number }
interface Job { slug: string; title: string; done: boolean; objs: Obj[]; coins: number; xp: number }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type Tab = "items" | "journal";

function ItemArt({ slug, size }: { slug: string; size: number }) {
  return <img src={itemImage(slug)} alt="" width={size} height={size} draggable={false} />;
}

/** The bag: what you're carrying (monster drops) and your journal of taken jobs with progress. */
export function BagMenu({ onClose, onUse }: { onClose: () => void; /** On a floor: drink/use an item on the party. Resolves true if it worked. */ onUse?: (slug: string) => Promise<boolean> }) {
  const [rev, setRev] = useState(0);
  const [sel, setSel] = useState<Item | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<Item[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = createClient();
      const [tpl, inv, q, o, pq, pp, prof] = await Promise.all([
        sb.from("item_templates").select("slug, name, rarity, blurb"),
        sb.from("player_items").select("item_slug, qty"),
        sb.from("quests").select("slug, title, reward_coins, reward_xp, sort").order("sort"),
        sb.from("quest_objectives").select("quest_slug, idx, kind, target_kind, target_boss, item_slug, qty"),
        sb.from("player_quests").select("quest_slug, status"),
        sb.from("player_quest_progress").select("quest_slug, idx, progress"),
        sb.from("profiles").select("floor_reached").single(),
      ]);
      if (!live) return;
      if (tpl.error || inv.error || q.error || o.error || pq.error || pp.error || !prof.data) return setError(true);
      const info = new Map((tpl.data ?? []).map((t) => [t.slug as string, t as { slug: string; name: string; rarity: string; blurb?: string }]));
      const qty = new Map((inv.data ?? []).map((r) => [r.item_slug as string, r.qty as number]));
      setItems(
        [...qty].filter(([, n]) => n > 0).map(([slug, n]) => ({ slug, name: info.get(slug)?.name ?? slug, rarity: info.get(slug)?.rarity ?? "common", qty: n, blurb: info.get(slug)?.blurb ?? "" }))
          .sort((a, b) => Object.keys(RARITY).indexOf(b.rarity) - Object.keys(RARITY).indexOf(a.rarity) || a.name.localeCompare(b.name)),
      );
      const status = new Map((pq.data ?? []).map((r) => [r.quest_slug as string, r.status as string]));
      const prog = new Map((pp.data ?? []).map((r) => [`${r.quest_slug}:${r.idx}`, r.progress as number]));
      const reached = prof.data.floor_reached as number;
      setJobs(
        (q.data ?? []).filter((x) => status.has(x.slug)).map((x) => {
          const done = status.get(x.slug) === "done";
          const objs = (o.data ?? []).filter((y) => y.quest_slug === x.slug).sort((a, b) => a.idx - b.idx).map((y) => {
            const need = y.qty as number;
            const have = done ? need : y.kind === "kill" ? prog.get(`${x.slug}:${y.idx}`) ?? 0 : y.kind === "reach" ? reached : qty.get(y.item_slug ?? "") ?? 0;
            const text = y.kind === "kill" ? `Defeat ${y.target_boss ? `the ${cap(y.target_kind ?? "")} boss` : `${cap(y.target_kind ?? "")}s`}`
              : y.kind === "reach" ? `Reach Floor ${need}` : `Bring ${info.get(y.item_slug ?? "")?.name ?? y.item_slug}`;
            return { idx: y.idx as number, text, have: Math.min(need, have), need };
          });
          return { slug: x.slug as string, title: x.title as string, done, objs, coins: x.reward_coins as number, xp: x.reward_xp as number };
        }).sort((a, b) => Number(a.done) - Number(b.done)),
      );
    })().catch(() => live && setError(true));
    return () => { live = false; };
  }, [rev]);

  const total = items?.reduce((s, i) => s + i.qty, 0) ?? 0;
  const closeAsk = () => { setAsk(null); setNote(null); };
  const confirm = async () => {
    if (!sel || !ask || busy) return;
    setBusy(true); setNote(null);
    try {
      if (ask.kind === "use") {
        const ok = onUse ? await onUse(sel.slug) : false;
        if (!ok) { setNote(`${sel.name} can't be used right now.`); return; }
      } else {
        const { error: e } = await createClient().rpc("discard_item", { p_slug: sel.slug, p_qty: ask.n });
        if (e) { setNote("Couldn't discard that. Try again."); return; }
      }
      setAsk(null); setSel(null); setRev((x) => x + 1);
    } finally { setBusy(false); }
  };

  const tabs: { id: Tab; label: string; icon: "bag" | "quest"; n?: number }[] = [
    { id: "items", label: "Items", icon: "bag", n: items ? total : undefined },
    { id: "journal", label: "Journal", icon: "quest", n: jobs?.filter((j) => !j.done).length },
  ];

  return (
    <div data-ui className="fixed inset-0 z-[9700] flex items-center justify-center bg-ink/70 p-3 short:p-2" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }} onPointerUp={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-label="Bag" className="pixel-box flex max-h-full w-full max-w-md flex-col bg-night short:max-w-2xl">
        <div className="flex items-stretch gap-1 border-b-2 border-steel p-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 px-2 py-1 text-xl uppercase ${tab === t.id ? "bg-gold text-ink" : "bg-panel text-paper"}`}>
              {t.icon === "bag" ? <img src="/ui/bag.png" alt="" width={26} height={26} draggable={false} /> : <UiIcon name="quest" size={26} />}
              {t.label}
              {!!t.n && <span className={`min-w-6 px-1 text-base ${tab === t.id ? "bg-ink/20" : "bg-night"}`}>{t.n}</span>}
            </button>
          ))}
          <button type="button" aria-label="Close" onClick={onClose} className="w-10 bg-panel text-2xl text-paper">✕</button>
        </div>

        <div className="min-h-48 short:min-h-24 overflow-y-auto p-3 short:p-2">
          {error ? <p role="alert" className="text-xl text-ember">Couldn&apos;t open your bag. Try again.</p>
            : (tab === "items" ? items : jobs) === null ? <div className="h-40 animate-pulse bg-panel" aria-busy="true" />
            : tab === "items" ? (
              items!.length === 0 ? <Empty icon="bag" text="Nothing yet" /> : (
                <>
                <p className={`mb-2 text-base ${total >= BAG_MAX ? "text-ember" : "text-steel"}`}>Bag {total}/{BAG_MAX}{total >= BAG_MAX ? " · full, new drops are lost" : " · tap an item"}</p>
                <ul className="grid grid-cols-4 gap-x-1.5 gap-y-2 sm:grid-cols-6 short:grid-cols-8">
                  {items!.map((i) => (
                    <li key={i.slug} className="flex min-w-0 flex-col items-center gap-1">
                      <button type="button" aria-label={`${i.name}, ${i.qty}`} onClick={() => { setSel(i); setAsk(null); setNote(null); }} className={`relative flex aspect-square w-full items-center justify-center border-2 bg-panel enabled:hover:brightness-125 ${RARITY[i.rarity]?.ring ?? "border-steel"}`}>
                        <ItemArt slug={i.slug} size={36} />
                        <span className="absolute bottom-0 right-0 bg-ink/80 px-1 text-sm leading-4 text-paper">{i.qty}</span>
                      </button>
                      <span className={`w-full text-center text-sm leading-3 ${RARITY[i.rarity]?.text ?? "text-paper"}`}>{i.name}</span>
                    </li>
                  ))}
                </ul>
                </>
              )
            ) : jobs!.length === 0 ? <Empty icon="quest" text="No jobs taken" /> : (
              <div className="flex flex-col gap-3">
                {([["Ongoing", jobs!.filter((j) => !j.done)], ["Completed", jobs!.filter((j) => j.done)]] as [string, Job[]][]).filter(([, l]) => l.length > 0).map(([label, list]) => (
                  <section key={label}>
                    <h3 className="mb-1 text-base uppercase text-steel">{label} · {list.length}</h3>
                    <ul className="flex flex-col gap-2">
                {list.map((j) => (
                  <li key={j.slug} className={`border-2 bg-panel p-2 ${j.done ? "border-leaf" : "border-steel"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xl uppercase text-paper short:text-lg">{j.title}</h4>
                      {j.done ? <span className="text-lg text-leaf">✓ Done</span> : <span className="flex items-center gap-1 text-base text-gold"><UiIcon name="coins" size={20} />{j.coins}</span>}
                    </div>
                    <ul className="mt-1 flex flex-col gap-1">
                      {j.objs.map((o) => (
                        <li key={o.idx}>
                          <div className="flex justify-between text-lg text-paper/90"><span>{o.text}</span><span className={o.have >= o.need ? "text-leaf" : ""}>{o.have}/{o.need}</span></div>
                          <div className="h-2 bg-ink" role="progressbar" aria-valuemin={0} aria-valuemax={o.need} aria-valuenow={o.have}>
                            <div className={`h-full ${o.have >= o.need ? "bg-leaf" : "bg-gold"}`} style={{ width: `${(o.have / o.need) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
        </div>
      </div>

      {sel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-3" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && !busy) { setSel(null); closeAsk(); } }}>
          <div role="dialog" aria-modal="true" aria-label={sel.name} className="pixel-box flex w-full max-w-sm flex-col gap-2 bg-night p-3 short:max-w-lg">
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center border-2 bg-panel ${RARITY[sel.rarity]?.ring ?? "border-steel"}`}><ItemArt slug={sel.slug} size={44} /></div>
              <div className="min-w-0">
                <p className={`truncate text-2xl uppercase ${RARITY[sel.rarity]?.text ?? "text-paper"}`}>{sel.name}</p>
                <p className="text-base text-steel">You have {sel.qty}</p>
              </div>
            </div>
            {sel.blurb && <p className="text-lg text-paper/90">{sel.blurb}</p>}
            {!ask ? (
              <div className="flex flex-wrap gap-2">
                {USABLE.includes(sel.slug) && (
                  <button type="button" disabled={!onUse} onClick={() => setAsk({ kind: "use", n: 1 })} className="flex-1 bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">Use</button>
                )}
                <button type="button" onClick={() => setAsk({ kind: "discard", n: 1 })} className="flex-1 bg-panel px-3 py-1 text-xl uppercase text-ember">Discard</button>
                <button type="button" onClick={() => setSel(null)} className="bg-panel px-3 py-1 text-xl uppercase text-paper">Close</button>
                {USABLE.includes(sel.slug) && !onUse && <p className="w-full text-base text-steel">Potions can be used out on the floors.</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2 border-t-2 border-steel pt-2">
                <p className="text-xl text-paper">{ask.kind === "use" ? `Use ${sel.name}?` : `Discard ${ask.n} × ${sel.name}? This can't be undone.`}</p>
                {ask.kind === "discard" && sel.qty > 1 && (
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer" onClick={() => setAsk({ ...ask, n: Math.max(1, ask.n - 1) })} className="h-8 w-8 bg-panel text-xl text-paper">−</button>
                    <span className="min-w-8 text-center text-xl text-paper">{ask.n}</span>
                    <button type="button" aria-label="More" onClick={() => setAsk({ ...ask, n: Math.min(sel.qty, ask.n + 1) })} className="h-8 w-8 bg-panel text-xl text-paper">+</button>
                    <button type="button" onClick={() => setAsk({ ...ask, n: sel.qty })} className="bg-panel px-2 text-base uppercase text-gold">All</button>
                  </div>
                )}
                {note && <p role="alert" className="text-lg text-ember">{note}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={confirm} className={`flex-1 px-3 py-1 text-xl uppercase text-ink disabled:opacity-50 ${ask.kind === "use" ? "bg-leaf" : "bg-ember"}`}>{busy ? "…" : ask.kind === "use" ? "Yes, use it" : "Yes, discard"}</button>
                  <button type="button" disabled={busy} onClick={closeAsk} className="flex-1 bg-panel px-3 py-1 text-xl uppercase text-paper">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: "bag" | "quest"; text: string }) {
  return <div className="flex h-40 flex-col items-center justify-center gap-2 text-xl uppercase text-paper/50">{icon === "bag" ? <img src="/ui/bag.png" alt="" width={56} height={56} className="opacity-40 grayscale" draggable={false} /> : <UiIcon name="quest" size={56} className="opacity-40 grayscale" />}{text}</div>;
}
