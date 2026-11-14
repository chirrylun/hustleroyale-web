"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelPanel } from "@/components/pixel/PixelPanel";
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
  level_too_low: "Not high enough level yet.", not_enough_points: "Not enough skill points.", locked: "Learn the earlier node first.",
  already_learned: "Already learned.", not_enough_coins: "Not enough coins.", no_book: "You don't own that book.",
  wrong_class: "This class can't use that skill.", not_learned: "Learn it first.",
};
const NEXT_USES = [25, 70, 150, 300];

const describe = (s: SkillInfo) =>
  `${s.kind === "heal" ? "Heal" : s.kind === "shield" ? "Shield" : s.damage_type === "magical" ? "Magic" : s.kind === "damage" ? "Damage" : s.kind} · cooldown ${(s.cooldown_ms / 1000).toFixed(1)}s · energy ${s.stamina_cost}`;

export function SkillManager({ fighter, equipped, learned, nodes, ownedNodes, stock, shop, coins }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [picking, setPicking] = useState<number | null>(null); // slot being filled

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
  const equippedIds = new Set(equipped.map((e) => e.skill.id));
  const library = learned.filter((l) => !l.skill.is_basic);
  const levelOf = (id: string) => learned.find((l) => l.skill.id === id);
  const owned = new Set(ownedNodes);
  const branches = [...new Set(nodes.map((n) => n.branch))];
  const learnedIds = new Set(learned.map((l) => l.skill.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl uppercase text-gold">{fighter.name} <span className="text-steel">· {ARCHETYPE_LABEL[fighter.archetype] ?? fighter.archetype} · Lv {fighter.level}</span></h2>
        <p className="text-xl text-paper">Skill points: <span className="text-gold">{fighter.points}</span> · Coins: {coins}</p>
      </div>
      {error && <p role="alert" className="pixel-box bg-blood px-3 py-2 text-lg text-paper">{error}</p>}

      <PixelPanel title="Equipped (they fire on their own)">
        <ol className="grid gap-2 sm:grid-cols-2">
          <li className="pixel-box bg-panel p-2 text-lg text-paper">
            <span className="text-steel">Basic · </span>{bySlot.get(1)?.name ?? "-"}
          </li>
          {[2, 3, 4, 5].map((slot) => {
            const s = bySlot.get(slot);
            return (
              <li key={slot} className="pixel-box bg-night p-2 text-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className={s ? "text-paper" : "text-steel"}>{slot - 1}. {s?.name ?? "Empty slot"}</span>
                  <span className="flex gap-1">
                    <button type="button" className="pixel-btn bg-panel px-2 text-base uppercase text-paper" onClick={() => setPicking(picking === slot ? null : slot)}>{s ? "Change" : "Add"}</button>
                    {s && <button type="button" disabled={busy} className="pixel-btn bg-panel px-2 text-base uppercase text-paper" onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: null }))}>Clear</button>}
                  </span>
                </div>
                {s && <p className="text-base text-steel">{describe(s)} · Lv {levelOf(s.id)?.level ?? 1}</p>}
                {picking === slot && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {library.filter((l) => l.skill.id !== s?.id).map((l) => (
                      <li key={l.skill.id}>
                        <button type="button" disabled={busy} onClick={() => run(() => sb.rpc("equip_skill", { p_fighter: fighter.id, p_slot: slot, p_skill: l.skill.id }))} className="pixel-btn w-full bg-leaf px-2 py-1 text-left text-base text-ink">
                          {l.skill.name} <span className="opacity-80">· {describe(l.skill)}</span>
                        </button>
                      </li>
                    ))}
                    {library.length === 0 && <li className="text-base text-steel">No learned skills yet.</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </PixelPanel>

      <PixelPanel title="Learned skills">
        <ul className="grid gap-2 sm:grid-cols-2">
          {library.map((l) => {
            const next = NEXT_USES[l.level - 1];
            return (
              <li key={l.skill.id} className="pixel-box bg-night p-2 text-lg text-paper">
                <div className="flex justify-between gap-2"><span>{l.skill.name}</span><span className="text-gold">Lv {l.level}</span></div>
                <p className="text-base text-steel">{l.skill.description ?? describe(l.skill)}</p>
                <p className="text-sm text-steel">{next ? `${l.uses} / ${next} uses to level ${l.level + 1}` : "Max level"}{equippedIds.has(l.skill.id) ? " · equipped" : ""}</p>
              </li>
            );
          })}
          {library.length === 0 && <li className="text-lg text-steel">Nothing yet. Choose a class at level 10, spend points in the tree, or read skill books.</li>}
        </ul>
      </PixelPanel>

      <PixelPanel title="Skill tree">
        {nodes.length === 0 ? (
          <p className="text-lg text-steel">{fighter.archetype === "novice" ? "Choose a class at level 10 to unlock a skill tree." : "No tree for this class yet."}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {branches.map((b) => (
              <div key={b} className="flex flex-col gap-2">
                <h3 className="text-xl uppercase text-leaf">{b}</h3>
                {nodes.filter((n) => n.branch === b).sort((a, c) => a.tier - c.tier).map((n) => {
                  const has = owned.has(n.id) || (!!n.skill_id && learnedIds.has(n.skill_id));
                  const locked = !!n.requires && !owned.has(n.requires);
                  const ready = !has && !locked && fighter.level >= n.min_level && fighter.points >= n.cost;
                  return (
                    <div key={n.id} className={clsx("pixel-box p-2 text-base", has ? "bg-leaf text-ink" : "bg-night text-paper", !has && locked && "opacity-60")}>
                      <p className="text-lg uppercase">{n.name}</p>
                      <p className={has ? "" : "text-steel"}>{n.description || "New skill"}</p>
                      <p className="text-sm">Level {n.min_level}+ · {n.cost} point{n.cost > 1 ? "s" : ""}</p>
                      {has ? <p className="text-sm uppercase">Learned</p> : (
                        <PixelButton className="mt-1 !px-2 !py-0.5 text-base" disabled={!ready || busy} onClick={() => run(() => sb.rpc("learn_node", { p_fighter: fighter.id, p_node: n.id }))}>
                          {locked ? "Locked" : fighter.level < n.min_level ? `Needs Lv ${n.min_level}` : fighter.points < n.cost ? "Not enough points" : "Learn"}
                        </PixelButton>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </PixelPanel>

      <PixelPanel title="Skill books">
        <ul className="grid gap-2 sm:grid-cols-2">
          {shop.map((s) => {
            const have = stock[s.id] ?? 0;
            const known = learnedIds.has(s.id);
            return (
              <li key={s.id} className="pixel-box bg-night p-2 text-lg text-paper">
                <div className="flex justify-between gap-2"><span>{s.name}</span><span className="text-gold">{s.price} coins</span></div>
                <p className="text-base text-steel">{s.description ?? describe(s)} · needs Lv {s.min_level}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PixelButton variant="ghost" className="!px-2 !py-0.5 text-base" disabled={busy || coins < (s.price ?? 0)} onClick={() => run(() => sb.rpc("buy_skill_book", { p_skill: s.id }))}>Buy</PixelButton>
                  {have > 0 && !known && <PixelButton className="!px-2 !py-0.5 text-base" disabled={busy || fighter.level < s.min_level} onClick={() => run(() => sb.rpc("use_skill_book", { p_fighter: fighter.id, p_skill: s.id }))}>Read ({have})</PixelButton>}
                  {known && <span className="text-base text-leaf">Learned</span>}
                </div>
              </li>
            );
          })}
          {shop.length === 0 && <li className="text-lg text-steel">No books for this class yet.</li>}
        </ul>
      </PixelPanel>
    </div>
  );
}
