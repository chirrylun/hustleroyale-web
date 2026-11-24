"use client";

import { Npc } from "@/components/npc/Npc";
import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { createClient } from "@/lib/supabase/client";

interface Quest { slug: string; title: string; blurb: string; kind: "kill" | "fetch" | "reach"; floor: number; unlocks_floor: number | null; reward_coins: number; reward_xp: number; sort: number; special?: boolean }
interface Objective { quest_slug: string; idx: number; kind: "kill" | "fetch" | "reach"; target_kind: string | null; target_boss: boolean; item_slug: string | null; qty: number }
interface Board {
  quests: Quest[]; objectives: Objective[];
  taken: Record<string, "active" | "done">;
  progress: Record<string, number>; // `${slug}:${idx}`
  items: Record<string, number>; names: Record<string, string>;
  reached: number; unlocked: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ERRORS: Record<string, string> = {
  do_kill_first: "Finish the kill job for this floor first.",
  floor_locked: "That floor isn't open yet.",
  already_taken: "You already took this job.",
  quest_not_done: "Not finished yet.",
};

/** The job board: jobs open to you, what you've taken, and what each still needs. */
export function JobBoard({ onChanged }: { onChanged: () => void }) {
  const [b, setB] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [q, o, pq, pp, it, inv, prof] = await Promise.all([
      sb.from("quests").select("slug, title, blurb, kind, floor, unlocks_floor, reward_coins, reward_xp, sort, special").order("sort"),
      sb.from("quest_objectives").select("quest_slug, idx, kind, target_kind, target_boss, item_slug, qty"),
      sb.from("player_quests").select("quest_slug, status"),
      sb.from("player_quest_progress").select("quest_slug, idx, progress"),
      sb.from("item_templates").select("slug, name"),
      sb.from("player_items").select("item_slug, qty"),
      sb.from("profiles").select("floor_reached, floor_unlocked").single(),
    ]);
    if (q.error || o.error || !prof.data) return setError("Couldn't load the board. Try again.");
    setB({
      quests: (q.data ?? []) as Quest[], objectives: (o.data ?? []) as Objective[],
      taken: Object.fromEntries((pq.data ?? []).map((r) => [r.quest_slug, r.status as "active" | "done"])),
      progress: Object.fromEntries((pp.data ?? []).map((r) => [`${r.quest_slug}:${r.idx}`, r.progress as number])),
      names: Object.fromEntries((it.data ?? []).map((r) => [r.slug, r.name as string])),
      items: Object.fromEntries((inv.data ?? []).map((r) => [r.item_slug, r.qty as number])),
      reached: prof.data.floor_reached as number, unlocked: prof.data.floor_unlocked as number,
    });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: "accept_quest" | "claim_quest", slug: string) => {
    setBusy(slug); setError(null); setNote(null);
    const { data, error: e } = await createClient().rpc(fn, { p_slug: slug });
    if (e) setError(ERRORS[Object.keys(ERRORS).find((k) => e.message.includes(k)) ?? ""] ?? "That didn't work. Try again.");
    else if (fn === "claim_quest") {
      const r = data as { coins: number; xp: number; unlocked: number | null; gear?: { name: string; rank: number; level: number } | null };
      setNote(`+${r.coins} coins, +${r.xp} XP${r.gear ? ` · ${r.gear.name} (rank ${r.gear.rank}, lv ${r.gear.level})` : ""}${r.unlocked ? ` · Floor ${r.unlocked} is open!` : ""}`);
      onChanged();
    }
    await load();
    setBusy(null);
  };

  if (!b) return <>{error ? <p role="alert" className="text-xl text-ember">{error}</p> : <div className="h-32 animate-pulse bg-panel" aria-busy="true" />}</>;

  const objs = (slug: string) => b.objectives.filter((o) => o.quest_slug === slug).sort((x, y) => x.idx - y.idx);
  const have = (q: Quest, o: Objective) => {
    const status = b.taken[q.slug];
    if (o.kind === "kill") return status === "done" ? o.qty : (b.progress[`${q.slug}:${o.idx}`] ?? 0);
    if (o.kind === "reach") return Math.min(o.qty, b.reached);
    return status === "done" ? o.qty : Math.min(o.qty, b.items[o.item_slug ?? ""] ?? 0);
  };
  const MINI: Record<string, string> = { slimeking: "Slime King", broodmother: "Broodmother", rimewarden: "Rimewarden" };
  const label = (o: Objective) =>
    o.kind === "kill" ? `Defeat ${MINI[o.target_kind ?? ""] ? `the ${MINI[o.target_kind ?? ""]}` : o.target_boss ? `the ${cap(o.target_kind ?? "")} boss` : `${cap(o.target_kind ?? "")}s`}` : o.kind === "reach" ? `Reach Floor ${o.qty}` : `Bring ${b.names[o.item_slug ?? ""] ?? o.item_slug}`;
  const killDone = (q: Quest) => b.quests.some((k) => k.kind === "kill" && k.unlocks_floor === q.unlocks_floor && b.taken[k.slug] === "done");

  const open = b.quests.filter((q) => q.floor <= b.unlocked && b.taken[q.slug] !== "done");
  // Taken jobs first, then the rest; a handful at a time so the board stays readable.
  const list = [...open].sort((x, y) => Number(!!b.taken[y.slug]) - Number(!!b.taken[x.slug]) || Number(!!y.special) - Number(!!x.special) || x.sort - y.sort).slice(0, 6);
  const doneCount = b.quests.filter((q) => b.taken[q.slug] === "done").length;

  return (
    <div>
      <div className="mb-2 flex items-end gap-3">
        <Npc name="secretary" className="w-14 shrink-0 short:w-10" />
        <div className="min-w-0">
          <h2 className="text-2xl uppercase text-gold short:text-xl">Job board</h2>
          <p className="text-base text-steel">Pick a job, then head out to the floors to finish it.</p>
        </div>
      </div>
      <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1 short:max-h-[55dvh]">
        {list.length === 0 && <p className="text-xl text-paper">No jobs open right now. Check back after you open new floors.</p>}
        {list.map((q) => {
          const status = b.taken[q.slug];
          const os = objs(q.slug);
          const complete = os.length > 0 && os.every((o) => have(q, o) >= o.qty);
          const blocked = q.kind === "fetch" && !status && !killDone(q);
          return (
            <div key={q.slug} className={`pixel-box bg-panel p-3 text-lg text-paper ${q.special ? "outline outline-2 outline-offset-2 outline-gold shadow-[0_0_10px_rgba(255,200,60,0.45)]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`uppercase ${q.special ? "text-gold" : "text-leaf"}`}>{q.special ? "★ " : ""}{q.title}</p>
                <p className="shrink-0 text-sm text-steel">Floor {q.kind === "reach" ? os[0]?.qty : q.floor}</p>
              </div>
              <p className="text-base text-steel">{q.blurb}</p>
              <ul className="my-1.5 space-y-0.5 text-base">
                {os.map((o) => {
                  const n = status || o.kind === "reach" ? have(q, o) : null;
                  return (
                    <li key={o.idx} className={n !== null && n >= o.qty ? "text-leaf" : undefined}>
                      {n !== null && n >= o.qty ? "✓ " : "• "}{label(o)}{n !== null ? ` ${n}/${o.qty}` : ` ×${o.qty}`}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-2">
                <p className="text-base text-gold">🪙 {q.reward_coins} · {q.reward_xp} XP{q.special ? ` · Gear rank ${Math.min(4, 1 + Math.ceil(q.floor / 10))} (lv ${Math.min(10, 1 + ((q.floor - 1) % 10))})` : ""}</p>
                {status === "active" ? (
                  <PixelButton className="text-base" disabled={!complete || busy === q.slug} onClick={() => act("claim_quest", q.slug)}>{complete ? "Claim" : "In progress"}</PixelButton>
                ) : blocked ? (
                  <span className="text-base text-steel">Do the kill job first</span>
                ) : (
                  <PixelButton className="text-base" disabled={busy === q.slug} onClick={() => act("accept_quest", q.slug)}>Take job</PixelButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {doneCount > 0 && <p className="mt-2 text-base text-steel">{doneCount} job{doneCount === 1 ? "" : "s"} completed.</p>}
      {note && <p role="status" className="mt-2 text-xl text-gold">{note}</p>}
      {error && <p role="alert" className="mt-2 text-xl text-ember">{error}</p>}
    </div>
  );
}
