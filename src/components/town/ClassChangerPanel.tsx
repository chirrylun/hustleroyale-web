"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { LiveSprite } from "@/components/sprites/LiveSprite";
import { Tag } from "@/components/ui/Tag";
import { UiIcon } from "@/components/ui/UiIcon";
import { ARCHETYPE_LABEL, RANK_LEVEL, RECRUITS, isRecruit, loadFighters, type GuildFighter } from "@/lib/guild";
import { setLook } from "@/lib/lookStore";
import { createClient } from "@/lib/supabase/client";

interface Option { archetype: string; tier: number; requires: string | null; owned: boolean; unlocked: boolean; current: boolean; min_level?: number }
interface Info { fee: number; ready: boolean; options: Option[] }
/** One class in the list. `action` is how it is taken: a Novice or Recruit chooses (free, choose_class), a fighter with a class changes (fee, change_class). */
interface Opt extends Option { min: number; action: "choose" | "change" }
type Node = Opt & { kids: Node[] };

/** The level each tier asks for when the database doesn't say (class_tree.min_level): first-tier classes at rank 2, then rank 3, then rank 4. */
const TIER_LEVEL: Record<number, number> = { 0: RANK_LEVEL.common, 1: RANK_LEVEL.uncommon, 2: RANK_LEVEL.rare, 3: RANK_LEVEL.legendary };
const MESSAGES: Record<string, string> = {
  not_enough_coins: "Not enough coins.", class_locked: "Needs the first class.", level_too_low: "Level too low.", choose_class_first: "Pick a class first.",
  class_not_available: "Not available.", already_has_class: "Already in that class.", sold_out: "Sold out right now.",
};
/** Classes no longer offered (the old tank Paladin; Paladin is now the Acolyte path after Battle Medic). */
const RETIRED = new Set(["paladin"]);
const BLURB: Record<string, string> = {
  fighter_tank: "Tough brawler that taunts enemies.", shield_tank: "Soaks hits and shields the team.", debuff_tank: "Weakens enemies while holding the line.", soldier: "Heavy hitter with strong armour.",
  pure_healer: "The strongest healing in the guild.", healer_fighter: "Fights up front and heals.", bard: "Heals and inspires with song.", healer_tank: "Holy front-liner who heals.", whitemage: "Powerful light magic.",
  rogue: "Fast striker with dodges.", magical_dps: "Ranged mage with stuns and area spells.", ranger: "Bow hunter with steady shots.",
  ninja: "Shadow assassin.", samurai: "Blade master.", blackmage: "Dark destructive magic. Grows from Mage.", necromancer: "Raises the dead.", marksman: "Long-range precision.", sharpshooter: "Rapid-fire archer.",
  recruit_fighter: "Learns Slash. Tough front-liner in training.", recruit_acolyte: "Learns Basic Heal.", recruit_thief: "Learns Stab and Dodge.",
};
const label = (a: string | null) => (a ? ARCHETYPE_LABEL[a] ?? a : "");

/** Turns the flat list into families: each first-tier class with the classes that grow out of it beneath it. */
function familiesOf(options: Opt[]): Node[] {
  const by = new Map<string, Node>(options.map((o) => [o.archetype, { ...o, kids: [] }]));
  const roots: Node[] = [];
  for (const n of by.values()) { const parent = n.requires ? by.get(n.requires) : undefined; (parent ? parent.kids : roots).push(n); }
  return roots;
}

/**
 * The class changer, in three steps that read top to bottom: pick a fighter, pick a class, confirm. Each class carries its level as a tag
 * (green once the fighter has it) and, for advanced classes, which class it grows out of; there is no reading to do.
 * Novices choose their Recruit class and Recruits their first class for free; a fighter with a class can change to another it may reach
 * (the fee is shown; weapons and armour come off, rank and level stay). Every rule is the database's (choose_class, change_class).
 */
export function ClassChangerPanel() {
  const [fighters, setFighters] = useState<GuildFighter[] | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setNote({ text: "Please sign in again.", bad: true }); return; }
    const [f, p] = await Promise.all([loadFighters(sb, user.id), sb.from("profiles").select("coins").single()]);
    for (const x of f) setLook(x.id, x.template.sprite_key); // gear that just came off shows at once, on every screen
    setFighters(f);
    setCoins((p.data?.coins as number | undefined) ?? null);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const cur = fighters?.find((f) => f.id === sel) ?? null;
  const stage = !cur ? null : cur.template.archetype === "novice" ? "novice" : isRecruit(cur.template.archetype) ? "recruit" : "class";

  const fetchInfo = useCallback((id: string) => {
    void createClient().rpc("class_changer", { p_fighter: id }).then(({ data }) => setInfo((data as Info | null) ?? null));
  }, []);
  /** Picks a fighter (or none) and asks the database which classes that fighter can reach. */
  const select = (id: string | null) => { setSel(id); setInfo(null); setPick(null); setConfirming(false); if (id) fetchInfo(id); };

  const opts: Opt[] = useMemo(() => {
    if (!cur || !stage) return [];
    if (stage === "novice") return [{ archetype: RECRUITS[cur.template.role].id, tier: 0, requires: null, owned: false, unlocked: true, current: false, min: TIER_LEVEL[0], action: "choose" }];
    if (!info) return [];
    return info.options.filter((o) => !RETIRED.has(o.archetype)).map((o) => ({ ...o, min: o.min_level ?? TIER_LEVEL[o.tier] ?? 1, action: stage === "recruit" ? "choose" : "change" }));
  }, [cur, stage, info]);
  const tree = useMemo(() => familiesOf(opts), [opts]);
  const picked = opts.find((o) => o.archetype === pick) ?? null;
  const fee = info?.fee ?? 0;
  const cost = picked?.action === "change" ? fee : 0;
  const canAfford = (coins ?? 0) >= cost;

  const go = async () => {
    if (!sel || !picked || busy) return;
    setBusy(true); setNote(null);
    const { error } = await createClient().rpc(picked.action === "choose" ? "choose_class" : "change_class", { p_fighter: sel, p_archetype: picked.archetype });
    setNote(error
      ? { text: MESSAGES[Object.keys(MESSAGES).find((k) => error.message.includes(k)) ?? ""] ?? "That didn't work. Try again.", bad: true }
      : { text: `${cur?.template.name ?? "Fighter"} is now a ${label(picked.archetype)}.`, bad: false });
    setPick(null); setConfirming(false);
    await load();
    setInfo(null); fetchInfo(sel);
    setBusy(false);
  };

  const row = (n: Node, depth = 0) => {
    const met = (cur?.level ?? 0) >= n.min;
    const open = !n.current && n.unlocked && met;
    const on = pick === n.archetype;
    return (
      <li key={n.archetype} className="min-w-0">
        <button
          type="button" disabled={!open} aria-pressed={on} onClick={() => { setPick(on ? null : n.archetype); setConfirming(false); }}
          className={`pixel-btn flex w-full items-center justify-between gap-2 px-2 py-2 text-left ${on ? "bg-gold text-ink" : "bg-panel text-paper"} ${open || n.current ? "" : "opacity-60"}`}
        >
          <span className="min-w-0">
            <span className="block truncate text-xl uppercase leading-5">{label(n.archetype)}</span>
            {BLURB[n.archetype] && <span className={`block text-sm leading-4 ${on ? "text-ink/80" : "text-steel"}`}>{BLURB[n.archetype]}</span>}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {n.current ? <Tag tone="gold">Current</Tag> : (
              <>
                <Tag tone={met ? "ok" : "bad"}>Lv {n.min}</Tag>
                {!n.unlocked ? <Tag tone="dim">Needs {label(n.requires)}</Tag> : n.owned ? <Tag tone="sky">Held before</Tag> : null}
              </>
            )}
          </span>
        </button>
        {n.kids.length > 0 && <ul className={`mt-1 space-y-1 border-l-2 border-steel pl-3 ${depth === 0 ? "ml-3" : "ml-1"}`}>{n.kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 text-xl text-paper">
        <span className="pixel-box flex min-h-11 items-center gap-1 bg-panel px-3 text-gold"><UiIcon name="coins" size={24} /> {coins ?? "…"}</span>
        {stage === "class" && <Tag tone="dim">Gear comes off</Tag>}
      </div>
      {note && <p role="alert" className={`shrink-0 text-lg ${note.bad ? "text-ember" : "text-leaf"}`}>{note.text}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
      <section aria-label="Choose a fighter" className="min-w-0 shrink-0 sm:w-52">
        <p className="mb-1 text-base uppercase text-gold">1 · Pick a fighter</p>
        {fighters === null ? <div className="h-24 animate-pulse bg-panel" aria-busy="true" /> : fighters.length === 0 ? <p className="text-lg text-steel">No fighters yet.</p> : (
          <ul className="flex gap-2 overflow-x-auto pb-1 sm:max-h-[48dvh] sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:pr-1">
            {fighters.map((f) => (
              <li key={f.id} className="shrink-0 sm:w-full">
                <button type="button" aria-pressed={f.id === sel} onClick={() => select(f.id === sel ? null : f.id)} className={`pixel-btn flex w-24 flex-col items-center px-1 pb-1 pt-0.5 sm:w-full sm:flex-row sm:gap-2 sm:py-1 ${f.id === sel ? "bg-gold text-ink" : "bg-panel text-paper"}`}>
                  <span className="pointer-events-none -mb-2 -mt-1 block h-14 w-14 shrink-0 sm:my-0"><LiveSprite id={f.id} spriteKey={f.template.sprite_key} role={f.template.role} still /></span>
                  <span className="min-w-0 sm:flex-1">
                    <span className="block w-full truncate text-center text-base leading-4 sm:text-left">{f.template.name}</span>
                    <span className="block text-center text-sm leading-4 opacity-80 sm:text-left">Lv {f.level}</span>
                    <span className="block w-full truncate text-center text-sm leading-4 opacity-80 sm:text-left">{label(f.template.archetype)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Choose a class" className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
        <p className="text-base uppercase text-gold">2 · Pick a class</p>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:max-h-[48dvh]">
          {!cur ? <p className="text-lg text-steel">Pick a fighter first.</p>
            : stage !== "novice" && info === null ? <div className="h-24 animate-pulse bg-panel" aria-busy="true" />
            : tree.length === 0 ? <p className="text-lg text-steel">No classes to take.</p>
            : <ul className="space-y-2">{tree.map((n) => row(n))}</ul>}
        </div>
      </section>

      </div>

      {cur && (
        <section aria-label="Confirm" className="pixel-box sticky bottom-0 shrink-0 space-y-1.5 bg-night p-2">
          {!picked ? <p className="text-lg text-steel">3 · Pick a class to continue.</p> : !confirming ? (
            <PixelButton className="w-full" disabled={busy || !canAfford} onClick={() => setConfirming(true)}>
              {canAfford ? `Become ${label(picked.archetype)} · ${cost ? `${cost} coins` : "Free"}` : `Need ${cost - (coins ?? 0)} more coins`}
            </PixelButton>
          ) : (
            <>
              <p role="alert" className="text-lg text-gold">{label(picked.archetype)}{picked.action === "change" ? " · gear comes off" : ""}</p>
              <div className="flex gap-2">
                <PixelButton className="flex-1" disabled={busy} onClick={go}>{busy ? "…" : "Confirm"}</PixelButton>
                <PixelButton variant="ghost" className="flex-1" disabled={busy} onClick={() => setConfirming(false)}>Back</PixelButton>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
