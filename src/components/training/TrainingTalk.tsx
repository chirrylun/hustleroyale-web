"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PixelButton } from "@/components/pixel/PixelButton";
import { Speech, SpeechActions } from "@/components/room/Speech";
import { LiveSprite } from "@/components/sprites/LiveSprite";
import { Tag } from "@/components/ui/Tag";
import { ARCHETYPE_LABEL, RECRUITS, RANK_LEVEL, isRecruit, loadFighters, type GuildFighter } from "@/lib/guild";
import { setLook } from "@/lib/lookStore";
import { itemName } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import { NPC_TAG, TRAINING_DONE, type TrainingNpc } from "@/lib/training";

export interface Reward { step: number; coins: number; xp: number; items: { slug: string; qty: number }[]; armor: unknown[] }

/** What a person in the training field says. The database decides whether a step is really done (training_advance); this only words it. */
export function TrainingTalk({ npc, step, kills, lowest, total, ready, recruits, potionSet, armored, onStep, onClassChanged, onClose }: {
  npc: TrainingNpc; step: number; kills: number; lowest: number; total: number; ready: number; recruits: number; potionSet: boolean; armored: boolean;
  onStep: (r: Reward) => void; onClassChanged: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [got, setGot] = useState<Reward | null>(null);
  const cur = got?.step ?? step;

  const advance = async (flagPotion = false) => {
    if (busy) return;
    setBusy(true); setNote(null);
    const sb = createClient();
    if (flagPotion) await sb.rpc("training_flag_potion");
    const { data, error } = await sb.rpc("training_advance");
    setBusy(false);
    if (error) { setNote(error.message.includes("training_not_ready") ? "Not quite yet. Check the goal along the top of the screen." : "That didn't work. Try again."); return; }
    const r = data as Reward;
    setGot(r); onStep(r);
    if (r.step === TRAINING_DONE) router.push("/lobby?tour=1");
  };

  // Like the job board: what a claim paid, shown under the list.
  const claimed = got && (got.coins || got.xp || got.items.length > 0 || got.armor.length > 0)
    ? `${[got.coins ? `+${got.coins} coins` : "", got.xp ? `+${got.xp} XP` : ""].filter(Boolean).join(", ")}${got.items.length > 0 ? ` · ${got.items.map((i) => `${i.qty} × ${itemName(i.slug)}`).join(", ")}` : ""}${got.armor.length > 0 ? " · Recruit armour for every fighter" : ""}`
    : null;

  const close = () => onClose();
  const done = <SpeechActions><PixelButton onClick={close}>Got it</PixelButton></SpeechActions>;

  if (npc === "changer") return <Speech npc="class_changer" title={NPC_TAG.changer} onClose={close} shop><ChangerBody step={step} onClassChanged={onClassChanged} onClose={close} /></Speech>;

  if (npc === "manager") {
    return (
      <Speech npc="manager" title={NPC_TAG.manager} onClose={close} still>
        {cur === 0 && (<>
          <p>Welcome to the training field! Speak to the <span className="text-gold">Trainer</span>, the soldier with the spear. He will set you a few quests.</p>
          <SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Understood</PixelButton></SpeechActions>
        </>)}
        {cur >= 1 && cur <= 6 && (<><p>Finish the Trainer&apos;s quests, then come back to me.</p>{done}</>)}
        {cur === 7 && (<>
          <p>Excellent work! Come, I will show you around the Main Lobby.</p>
          <SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Take me to the lobby</PixelButton><PixelButton variant="ghost" onClick={close}>Not yet</PixelButton></SpeechActions>
        </>)}
        {note && <p role="alert" className="text-lg text-ember">{note}</p>}
      </Speech>
    );
  }

  // Step 1 is "take the first quest" (database step 2 is its goal), so quest 1 is open while step is 1 or 2.
  const status = (n: number): "done" | "active" | "locked" => (cur > n ? "done" : cur === n || (n === 2 && cur === 1) ? "active" : "locked");
  const QUESTS = [
    { n: 2, title: "", blurb: "Tap a slime and your party attacks it. Slimes only fight back if you hit them.", goal: "Defeat a slime", have: Math.min(1, kills), need: 1, reward: "🪙 100 · 53 XP", ok: kills >= 1 },
    { n: 3, title: "", blurb: "Keep fighting slimes. Open the Fighters button on the left to see each level.", goal: "Every fighter at level 5", have: Math.min(total, ready), need: total, reward: "🪙 250 · 106 XP · 20 potions", ok: lowest >= 5 },
    { n: 4, title: "", blurb: "Tap an empty slot at the bottom of the screen and pick a potion. Follow the blinking slot, then tap it to drink one when a fighter is hurt.", goal: "Put a potion in a shortcut slot", have: potionSet ? 1 : 0, need: 1, reward: "Drink it in one tap", ok: potionSet },
    { n: 5, title: "", blurb: "Tap the Rookie Class Changer. At level 5 each Novice can become a Recruit of their role, for free.", goal: "Every fighter a Recruit", have: Math.min(total, recruits), need: total, reward: "Recruit armour for everyone", ok: recruits >= total && total > 0 },
    { n: 6, title: "", blurb: "Open Fighters on the left, then Equipment. Put the armour on your first fighter; the blinking buttons will guide you. You can dress the others after.", goal: "Wear your armour", have: armored ? 1 : 0, need: 1, reward: "Armour on your back", ok: armored },
  ];
  const claim = (q: (typeof QUESTS)[number]) => advance(q.n === 4);

  return (
    <Speech npc="trainer" title={NPC_TAG.trainer} onClose={close} wide still>
      {cur === 0 && (<><p>Hold on there. The Guild Manager wants a word with you first.</p>{done}</>)}
      {cur >= 1 && cur <= 6 && (<>
        <p className="text-base text-steel">Quest board. Take a quest, finish it, then claim your reward.</p>
        <div className="space-y-2 sm:max-h-[46dvh] sm:overflow-y-auto sm:pr-1 short:max-h-[52dvh]">
          {QUESTS.map((q) => {
            const st = status(q.n);
            const first = q.n === 2 && cur === 1; // the first quest has to be taken
            return (
              <div key={q.n} className={`pixel-box bg-panel p-3 text-lg text-paper ${st === "done" ? "opacity-60" : ""}`}>
                <p className={`uppercase ${st === "locked" ? "text-steel" : "text-leaf"}`}>Training Quest {q.n - 1}</p>
                <p className="text-base text-steel">{q.blurb}</p>
                <ul className="my-1.5 text-base"><li className={st === "done" || q.ok ? "text-leaf" : undefined}>{st === "done" || q.ok ? "✓ " : "• "}{q.goal}{st === "locked" ? "" : ` ${st === "done" ? q.need : q.have}/${q.need}`}</li></ul>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-base text-gold">{q.reward}</p>
                  {st === "done" ? <span className="text-base text-leaf">Done</span>
                    : st === "locked" ? <span className="text-base text-steel">Locked</span>
                    : first ? <PixelButton className="text-base" disabled={busy} onClick={() => advance()}>Take quest</PixelButton>
                    : q.n === 5 && !q.ok ? <PixelButton className="text-base" disabled>In progress</PixelButton>
                    : <PixelButton className="text-base" disabled={!q.ok || busy} onClick={() => claim(q)}>{q.ok ? "Claim" : "In progress"}</PixelButton>}
                </div>
              </div>
            );
          })}
        </div>
        {claimed && <p role="status" className="text-xl text-gold">{claimed}</p>}
        {note && <p role="alert" className="text-lg text-ember">{note}</p>}
        <SpeechActions><PixelButton variant="ghost" onClick={close}>Close</PixelButton></SpeechActions>
      </>)}
      {cur === 7 && (<>{claimed && <p role="status" className="text-xl text-gold">{claimed}</p>}<p>That is everything I can teach you. Go back to the <span className="text-gold">Guild Manager</span>, he will take you on.</p>{done}</>)}
    </Speech>
  );
}

/**
 * The Rookie Class Changer: a Novice becomes the Recruit of its role at level 5, free. Recruit is the only class on offer here; the rest
 * come at level 20 from the Class Changer in the lobby. Each fighter is a card with its level and class as tags and one class to take.
 */
function ChangerBody({ onClassChanged }: { step: number; onClassChanged: () => void; onClose: () => void }) {
  const [mates, setMates] = useState<GuildFighter[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setNote({ text: "Please sign in again.", bad: true }); return; }
    const all = (await loadFighters(sb, user.id)).filter((f) => f.team_slot > 0);
    for (const f of all) setLook(f.id, f.template.sprite_key);
    setMates(all);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const become = async (m: GuildFighter) => {
    if (busy) return;
    setBusy(m.id); setNote(null);
    const { error } = await createClient().rpc("choose_class", { p_fighter: m.id, p_archetype: RECRUITS[m.template.role].id });
    if (error) setNote({ text: error.message.includes("level_too_low") ? `Level ${RANK_LEVEL.common} first.` : "That didn't work. Try again.", bad: true });
    else { setNote({ text: `${m.template.name} is now a ${ARCHETYPE_LABEL[RECRUITS[m.template.role].id]}.`, bad: false }); onClassChanged(); }
    await load();
    setBusy(null);
  };

  return (
    <>
      {note && <p role="alert" className={`text-lg ${note.bad ? "text-ember" : "text-leaf"}`}>{note.text}</p>}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {mates === null ? <li className="h-24 animate-pulse bg-panel" aria-busy="true" /> : mates.length === 0 ? <li className="text-lg text-steel">Put a fighter in your team first.</li> : mates.map((m) => {
          const novice = m.template.archetype === "novice";
          const recruitId = RECRUITS[m.template.role].id;
          const met = m.level >= RANK_LEVEL.common;
          return (
            <li key={m.id} className="pixel-box bg-panel p-2">
              <div className="flex items-center gap-2">
                <div className="pointer-events-none -mb-1 -mt-1 h-14 w-14 shrink-0"><LiveSprite id={m.id} spriteKey={m.template.sprite_key} role={m.template.role} still /></div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{m.template.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1"><Tag tone="dim">Lv {m.level}</Tag><Tag tone="dim">{ARCHETYPE_LABEL[m.template.archetype] ?? m.template.archetype}</Tag></div>
                </div>
              </div>
              {/* The one class on offer here */}
              {novice
                ? <button type="button" disabled={!met || busy !== null} onClick={() => become(m)} className="pixel-btn mt-2 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-gold px-2 py-2 text-left text-ink disabled:opacity-60">
                    <span className="text-xl uppercase">{ARCHETYPE_LABEL[recruitId]}</span>
                    <span className="flex gap-1"><Tag tone={met ? "ok" : "bad"}>Lv {RANK_LEVEL.common}</Tag><Tag tone="dim">Free</Tag></span>
                  </button>
                : <div className="mt-2 flex items-center justify-between gap-2 bg-night px-2 py-2"><span className="text-xl uppercase text-paper">{ARCHETYPE_LABEL[isRecruit(m.template.archetype) ? m.template.archetype : recruitId]}</span><Tag tone="gold">{isRecruit(m.template.archetype) ? "Current" : "Done"}</Tag></div>}
            </li>
          );
        })}
      </ul>
      <div className="flex shrink-0 items-center gap-2"><Tag tone="dim">More classes</Tag><Tag tone="bad">Lv {RANK_LEVEL.uncommon}</Tag><Tag tone="dim">Lobby</Tag></div>
    </>
  );
}
