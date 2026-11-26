"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SkillIcon } from "./SkillIcon";
import { ARCHETYPE_LABEL } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";

export interface SkillInfo {
  id: string; slug: string; name: string; description: string | null; kind: string; damage_type: string;
  power: number | string; cooldown_ms: number; stamina_cost: number; is_basic: boolean; source: string;
  min_level: number; price: number | null; class_archetype: string | null; roles: string[] | null;
}
export interface NodeRow {
  id: string; branch: string; tier: number; name: string; description: string; min_level: number; cost: number;
  requires: string | null; skill_id: string | null; boost: Record<string, number> | null;
}
interface Props {
  fighter: { id: string; name: string; role: string; archetype: string; level: number; points: number };
  equipped: { slot: number; skill: SkillInfo }[];
  learned: { level: number; uses: number; skill: SkillInfo }[];
  nodes: NodeRow[];
  ownedNodes: string[];
  stock: Record<string, number>;
  shop: SkillInfo[];
  coins: number;
}

const ERR: Record<string, string> = {
  level_too_low: "Not high enough level yet.", not_enough_points: "Not enough skill points.", locked: "Learn the earlier skill first.",
  already_learned: "Already learned.", not_enough_coins: "Not enough coins.", no_book: "You don't own that book.",
  wrong_class: "This class can't use that skill.", not_learned: "Learn it first.",
};
const NEXT_USES = [25, 70, 150, 300];
const ALL_SLOTS = [1, 2, 3, 4, 5];

/** What a skill does, in one glance: a symbol, a plain label and a colour. */
const KIND: Record<string, { icon: string; label: string; tone: string }> = {
  damage: { icon: "⚔", label: "Attack", tone: "bg-blood text-paper" },
  heal: { icon: "✚", label: "Heal", tone: "bg-leaf text-ink" },
  shield: { icon: "🛡", label: "Shield", tone: "bg-steel text-ink" },
  buff: { icon: "▲", label: "Boost", tone: "bg-gold text-ink" },
  debuff: { icon: "▼", label: "Weaken", tone: "bg-ember text-ink" },
};
const kindOf = (s: SkillInfo) => KIND[s.kind] ?? { icon: "•", label: s.kind, tone: "bg-panel text-paper" };

/** The plain-language line under a skill: its own description, or one built from its numbers. */
const effect = (s: SkillInfo) => {
  if (s.description) return s.description;
  const pct = Math.round(Number(s.power) * 100);
  if (s.kind === "heal") return "Restores an ally's health.";
  if (s.kind === "shield") return "Absorbs damage for a few seconds.";
  if (s.kind === "damage") return `Hits for ${pct}% of your ${s.damage_type === "magical" ? "magic" : "attack"}.`;
  return "A helpful effect in a fight.";
};

function Chip({ children, tone = "bg-panel text-paper" }: { children: React.ReactNode; tone?: string }) {
  return <span className={clsx("inline-block px-1.5 py-0.5 text-sm uppercase leading-none", tone)}>{children}</span>;
}

/** A skill's tag row: what it is, how often it can fire, what it costs. */
function Tags({ s }: { s: SkillInfo }) {
  const k = kindOf(s);
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Chip tone={k.tone}>{k.icon} {k.label}</Chip>
      {s.cooldown_ms > 0 && <Chip>⏱ every {(s.cooldown_ms / 1000).toFixed(0)}s</Chip>}
      {s.stamina_cost > 0 && <Chip>⚡ {s.stamina_cost} energy</Chip>}
    </div>
  );
}

type Tab = "loadout" | "tree" | "books";

export function SkillManager({ fighter, equipped, learned, nodes, ownedNodes, stock, shop, coins }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [picking, setPicking] = useState<number | null>(null); // slot being filled
  const [tab, setTab] = useState<Tab>("loadout");

  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>) =>
    start(async () => {
      setError(null);
      const { error: e } = await fn();
      if (e) return setError(ERR[e.message] ?? "That didn't work. Try again.");
      setPicking(null);
      router.refresh();
    });
  const sb = createClient();

  const bySlot = new Map(equipped.map((e) => [e.slot, e.skill]));
  const slotOf = new Map(equipped.map((e) => [e.skill.id, e.slot]));
  const library = learned.filter((l) => !l.skill.is_basic);
  const levelOf = (id: string) => learned.find((l) => l.skill.id === id);
  const owned = new Set(ownedNodes);
  const branches = [...new Set(nodes.map((n) => n.branch))];
  const learnedIds = new Set(learned.map((l) => l.skill.id));
  const readyNodes = nodes.filter((n) => !(owned.has(n.id) || (n.skill_id && learnedIds.has(n.skill_id))) && !(n.requires && !owned.has(n.requires)) && fighter.level >= n.min_level && fighter.points >= n.cost).length;
  const unequipped = library.filter((l) => !slotOf.has(l.skill.id));

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "loadout", label: "Loadout" },
    { id: "tree", label: "Learn skills", badge: readyNodes },
    { id: "books", label: "Skill books" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl uppercase text-gold">{fighter.name} <span className="text-steel">· {ARCHETYPE_LABEL[fighter.archetype] ?? fighter.archetype} · Lv {fighter.level}</span></h2>
        <p className="flex gap-4 text-xl text-paper">
          <span title="Earn one for each level. Spend them in Learn skills.">Skill points <span className="ml-1 bg-gold px-2 text-ink">{fighter.points}</span></span>
          <span>🪙 {coins}</span>
        </p>
      </div>

      {error && <p role="alert" className="pixel-box bg-blood px-3 py-2 text-lg text-paper">{error}</p>}

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={clsx("pixel-btn px-3 py-1 text-lg uppercase", tab === t.id ? "bg-gold text-ink" : "bg-panel text-paper")}
          >
            {t.label}{!!t.badge && <span className="ml-2 bg-leaf px-1.5 text-base text-ink">{t.badge} ready</span>}
          </button>
        ))}
      </div>

      {tab === "loadout" && (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-xl uppercase text-gold">Skills</h3>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_SLOTS.map((slot) => {
                const s = bySlot.get(slot);
                const open = picking === slot;
                const fixed = slot === 1; // the basic attack keeps its place
                const lv = s ? levelOf(s.id) : undefined;
                const next = lv ? NEXT_USES[lv.level - 1] : undefined;
                return (
                  <li key={slot} className={clsx("pixel-box flex flex-col gap-1 p-3 text-lg", s ? "bg-night" : "bg-night/60")}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 bg-panel px-2 text-paper">{slot}</span>
                      {s ? <SkillIcon name={s.name} kind={s.kind} size={52} /> : <SkillIcon name="" file="empty" size={52} dim />}
                      {s ? (
                        <div className="min-w-0 flex-1" title={effect(s)}>
                          <p className="flex justify-between gap-2 text-paper"><span>{s.name}</span><span className="text-gold">Lv {lv?.level ?? 1}</span></p>
                          <Tags s={s} />
                          {next && <div className="mt-2 h-1.5 bg-panel" title={`${lv?.uses ?? 0}/${next} uses to level ${(lv?.level ?? 1) + 1}`}><div className="h-full bg-gold" style={{ width: `${Math.min(100, ((lv?.uses ?? 0) / next) * 100)}%` }} /></div>}
                        </div>
                      ) : (
                        <p className="text-steel">Empty</p>
                      )}
                    </div>
                    {!fixed && (
                      <div className="mt-1 flex gap-2">
                        <PixelButton variant={s ? "ghost" : "primary"} className="!px-3 !py-0.5 text-base" disabled={busy} onClick={() => setPicking(open ? null : slot)}>
                          {open ? "Cancel" : s ? "Change" : "Add"}
                        </PixelButton>
                        {s && (
                          <PixelButton variant="ghost" className="!px-3 !py-0.5 text-base" disabled={busy} onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: null }))}>
                            Remove
                          </PixelButton>
                        )}
                      </div>
                    )}
                    {open && (
                      <ul className="mt-1 flex flex-col gap-1 border-t-2 border-panel pt-2">
                        {library.length === 0 && (
                          <li className="text-base text-steel">
                            Nothing learned yet. <button type="button" className="text-gold underline" onClick={() => setTab("tree")}>Learn skills</button> · <button type="button" className="text-gold underline" onClick={() => setTab("books")}>Skill books</button>
                          </li>
                        )}
                        {library.filter((l) => l.skill.id !== s?.id).map((l) => {
                          const elsewhere = slotOf.get(l.skill.id);
                          return (
                            <li key={l.skill.id}>
                              <button
                                type="button" disabled={busy || elsewhere !== undefined} title={effect(l.skill)}
                                onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: l.skill.id }))}
                                className="pixel-btn w-full bg-panel px-2 py-1 text-left text-base text-paper disabled:opacity-50"
                              >
                                <span className="flex items-center gap-2">
                                  <SkillIcon name={l.skill.name} kind={l.skill.kind} size={36} dim={elsewhere !== undefined} />
                                  <span className="min-w-0"><span className="text-lg">{l.skill.name}</span>{elsewhere !== undefined && <span className="text-gold"> · slot {elsewhere}</span>}<Tags s={l.skill} /></span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          {unequipped.length > 0 && (
            <div>
              <h3 className="mb-2 text-xl uppercase text-gold">Not equipped</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unequipped.map((l) => (
                  <li key={l.skill.id} className="pixel-box bg-night p-2 text-lg text-paper" title={effect(l.skill)}>
                    <div className="flex items-start gap-2">
                      <SkillIcon name={l.skill.name} kind={l.skill.kind} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="flex justify-between gap-2"><span>{l.skill.name}</span><span className="text-gold">Lv {l.level}</span></p>
                        <Tags s={l.skill} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "tree" && (
        <section className="flex flex-col gap-3">
          <p className="text-lg text-steel">Skills cost skill points. You earn one for every level. Learn them top to bottom: a skill unlocks after the one above it.</p>
          {nodes.length === 0 ? (
            <p className="pixel-box bg-night p-3 text-lg text-steel">{fighter.archetype === "novice" ? "Become a Recruit at level 5, then reach level 10, to unlock a skill tree." : "No skill tree for this class yet."}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {branches.map((b) => (
                <div key={b} className="flex flex-col gap-1">
                  <h3 className="text-xl uppercase text-leaf">{b}</h3>
                  {nodes.filter((n) => n.branch === b).sort((a, c) => a.tier - c.tier).map((n, idx) => {
                    const has = owned.has(n.id) || (!!n.skill_id && learnedIds.has(n.skill_id));
                    const locked = !!n.requires && !owned.has(n.requires);
                    const lowLevel = fighter.level < n.min_level;
                    const ready = !has && !locked && !lowLevel && fighter.points >= n.cost;
                    const why = has ? "Learned" : locked ? "Learn the skill above first" : lowLevel ? `Reach level ${n.min_level}` : fighter.points < n.cost ? `Needs ${n.cost} point${n.cost > 1 ? "s" : ""} (you have ${fighter.points})` : "Ready to learn";
                    return (
                      <div key={n.id} className="flex flex-col gap-1">
                        {idx > 0 && <span aria-hidden className="text-center text-steel">▼</span>}
                        <div className={clsx("pixel-box p-2 text-base", has ? "bg-leaf text-ink" : ready ? "bg-night text-paper ring-2 ring-gold" : "bg-night text-paper opacity-70")}>
                          <div className="flex items-start gap-2">
                            <SkillIcon name={n.name} kind={n.skill_id ? undefined : null} size={44} dim={!has && !ready} />
                            <div className="min-w-0 flex-1">
                              <p className="text-lg uppercase">{n.name}</p>
                              <p className={has ? "" : "text-steel"}>{n.description || "A new skill."}</p>
                            </div>
                          </div>
                          <p className="mt-1 text-sm uppercase">{has ? "✔ Learned" : why}</p>
                          {!has && (
                            <PixelButton className="mt-1 !px-3 !py-0.5 text-base" disabled={!ready || busy} onClick={() => run(() => sb.rpc("learn_node", { p_fighter: fighter.id, p_node: n.id }))}>
                              Learn · {n.cost} pt{n.cost > 1 ? "s" : ""}
                            </PixelButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "books" && (
        <section className="flex flex-col gap-3">
          <p className="text-lg text-steel">Buy a skill book with coins, then read it to learn that skill straight away.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {shop.map((s) => {
              const have = stock[s.id] ?? 0;
              const known = learnedIds.has(s.id);
              return (
                <li key={s.id} className="pixel-box bg-night p-2 text-lg text-paper">
                  <div className="flex items-start gap-2">
                    <SkillIcon name={s.name} kind={s.kind} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2"><span>{s.name}</span><span className="text-gold">🪙 {s.price}</span></div>
                      <p className="text-base text-steel">{effect(s)}</p>
                      <Tags s={s} />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-steel">Needs level {s.min_level}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {known ? <span className="text-base uppercase text-leaf">✔ Learned</span> : (
                      <>
                        <PixelButton variant="ghost" className="!px-3 !py-0.5 text-base" disabled={busy || coins < (s.price ?? 0)} onClick={() => run(() => sb.rpc("buy_skill_book", { p_skill: s.id }))}>
                          {coins < (s.price ?? 0) ? "Not enough coins" : "Buy"}
                        </PixelButton>
                        {have > 0 && <PixelButton className="!px-3 !py-0.5 text-base" disabled={busy || fighter.level < s.min_level} onClick={() => run(() => sb.rpc("use_skill_book", { p_fighter: fighter.id, p_skill: s.id }))}>{fighter.level < s.min_level ? `Needs Lv ${s.min_level}` : `Read (${have} owned)`}</PixelButton>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {shop.length === 0 && <li className="pixel-box bg-night p-3 text-lg text-steel sm:col-span-2">No books for this fighter yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
