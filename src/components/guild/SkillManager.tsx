"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
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
const SPECIAL_SLOTS = [2, 3, 4, 5];

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
  const basic = bySlot.get(1);
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

      <ol className="grid gap-2 text-lg text-paper sm:grid-cols-3">
        {[
          ["1", "Learn", "Spend skill points or read a skill book."],
          ["2", "Equip", "Put up to 4 skills in your loadout."],
          ["3", "Fight", "They fire on their own when they are ready."],
        ].map(([n, t, d]) => (
          <li key={n} className="pixel-box flex items-start gap-2 bg-night p-2">
            <span className="shrink-0 bg-gold px-2 text-ink">{n}</span>
            <span><b className="uppercase">{t}</b> <span className="text-steel">{d}</span></span>
          </li>
        ))}
      </ol>

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
          <div className="pixel-box bg-panel p-3 text-lg text-paper">
            <p className="text-sm uppercase text-steel">Always used</p>
            <p><span className="mr-2">⚔</span>{basic?.name ?? "Basic attack"}<span className="text-steel"> · your normal attack, nothing to set up</span></p>
          </div>

          <div>
            <h3 className="text-xl uppercase text-gold">Special skills</h3>
            <p className="mb-2 text-lg text-steel">Each fires by itself when it is ready and the moment is right: heals when an ally is hurt, shields when a fight starts, attacks when an enemy is close. Skills higher in the list get the first try.</p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {SPECIAL_SLOTS.map((slot, i) => {
                const s = bySlot.get(slot);
                const open = picking === slot;
                return (
                  <li key={slot} className={clsx("pixel-box flex flex-col gap-1 p-3 text-lg", s ? "bg-night" : "bg-night/60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 bg-panel px-2 text-paper">{i + 1}</span>
                        {s ? (
                          <div>
                            <p className="text-paper">{s.name} <span className="text-gold">Lv {levelOf(s.id)?.level ?? 1}</span></p>
                            <p className="text-base text-steel">{effect(s)}</p>
                            <Tags s={s} />
                          </div>
                        ) : (
                          <p className="text-steel">Empty. Equip a skill to use it in fights.</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex gap-2">
                      <PixelButton variant={s ? "ghost" : "primary"} className="!px-3 !py-0.5 text-base" disabled={busy} onClick={() => setPicking(open ? null : slot)}>
                        {open ? "Cancel" : s ? "Change" : "Equip a skill"}
                      </PixelButton>
                      {s && (
                        <PixelButton variant="ghost" className="!px-3 !py-0.5 text-base" disabled={busy} onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: null }))}>
                          Remove
                        </PixelButton>
                      )}
                    </div>
                    {open && (
                      <ul className="mt-1 flex flex-col gap-1 border-t-2 border-panel pt-2">
                        {library.length === 0 && (
                          <li className="text-base text-steel">
                            You haven&apos;t learned any special skills yet. <button type="button" className="text-gold underline" onClick={() => setTab("tree")}>Learn one</button> or <button type="button" className="text-gold underline" onClick={() => setTab("books")}>read a skill book</button>.
                          </li>
                        )}
                        {library.filter((l) => l.skill.id !== s?.id).map((l) => {
                          const elsewhere = slotOf.get(l.skill.id);
                          return (
                            <li key={l.skill.id}>
                              <button
                                type="button" disabled={busy || elsewhere !== undefined}
                                onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: l.skill.id }))}
                                className="pixel-btn w-full bg-panel px-2 py-1 text-left text-base text-paper disabled:opacity-50"
                              >
                                <span className="text-lg">{l.skill.name}</span>{elsewhere !== undefined && <span className="text-gold"> · in slot {elsewhere - 1}</span>}
                                <span className="block text-steel">{effect(l.skill)}</span>
                                <Tags s={l.skill} />
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

          <div>
            <h3 className="mb-2 text-xl uppercase text-gold">Your skills</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {library.map((l) => {
                const next = NEXT_USES[l.level - 1];
                const slot = slotOf.get(l.skill.id);
                return (
                  <li key={l.skill.id} className="pixel-box bg-night p-2 text-lg text-paper">
                    <div className="flex justify-between gap-2"><span>{l.skill.name}</span><span className="text-gold">Lv {l.level}</span></div>
                    <p className="text-base text-steel">{effect(l.skill)}</p>
                    <Tags s={l.skill} />
                    {next ? (
                      <div className="mt-2" title="Skills level up as they are used">
                        <div className="h-2 bg-panel"><div className="h-full bg-gold" style={{ width: `${Math.min(100, (l.uses / next) * 100)}%` }} /></div>
                        <p className="text-sm text-steel">{l.uses}/{next} uses to level {l.level + 1}</p>
                      </div>
                    ) : <p className="mt-1 text-sm text-steel">Max level</p>}
                    <p className={clsx("text-sm uppercase", slot ? "text-leaf" : "text-steel")}>{slot ? `Equipped in slot ${slot - 1}` : "Not equipped"}</p>
                  </li>
                );
              })}
              {library.length === 0 && (
                <li className="pixel-box bg-night p-3 text-lg text-steel sm:col-span-2">
                  {fighter.archetype === "novice"
                    ? "No special skills yet. Novices learn their first at level 10 when they choose a class; until then you can read skill books."
                    : "No special skills yet. Open Learn skills to spend your skill points."}
                </li>
              )}
            </ul>
            {unequipped.length > 0 && <p className="mt-2 text-lg text-gold">You have {unequipped.length} learned skill{unequipped.length > 1 ? "s" : ""} not equipped. Add {unequipped.length > 1 ? "them" : "it"} to a slot above.</p>}
          </div>
        </section>
      )}

      {tab === "tree" && (
        <section className="flex flex-col gap-3">
          <p className="text-lg text-steel">Skills cost skill points. You earn one for every level. Learn them top to bottom: a skill unlocks after the one above it.</p>
          {nodes.length === 0 ? (
            <p className="pixel-box bg-night p-3 text-lg text-steel">{fighter.archetype === "novice" ? "Choose a class at level 10 to unlock a skill tree." : "No skill tree for this class yet."}</p>
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
                          <p className="text-lg uppercase">{n.name}</p>
                          <p className={has ? "" : "text-steel"}>{n.description || "A new skill."}</p>
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
                  <div className="flex justify-between gap-2"><span>{s.name}</span><span className="text-gold">🪙 {s.price}</span></div>
                  <p className="text-base text-steel">{effect(s)}</p>
                  <Tags s={s} />
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
